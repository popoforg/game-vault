import { useEffect, useRef, useState } from 'react';
import { CopyOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons';
import { Button, Input, Rate, Select, Slider, message, type InputRef } from 'antd';
import type { EditableGame, Tag } from '../types';
import { TipTapRenderer } from './TipTapRenderer';
import { ThumbnailPreviewPanel } from './ThumbnailPreviewPanel';
import { getPrimaryThumbnail } from '../utils/thumbnails';

const { TextArea } = Input;

interface GameEditorFormProps {
  value: EditableGame;
  onChange: (nextValue: EditableGame) => void;
  tags: Tag[];
  allPlatforms: string[];
  showTagInfo?: boolean;
  expandedTagId?: string | null;
  onTagClick?: (tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null> | string | null;
  autoFocusName?: boolean;
}

export const GameEditorForm = ({
  value,
  onChange,
  tags,
  allPlatforms,
  showTagInfo = true,
  expandedTagId = null,
  onTagClick,
  onCreateTag,
  autoFocusName = false,
}: GameEditorFormProps) => {
  const normalizeAliases = (rawAliases: string[]) => {
    const seen = new Set<string>();
    const normalized: string[] = [];
    rawAliases.forEach((item) => {
      const alias = String(item || '').trim();
      if (!alias) return;
      const key = alias.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(alias);
    });
    return normalized;
  };

  const gameTags = tags.filter((tag) => value.tags.includes(tag.id));
  const [tagSearchValue, setTagSearchValue] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagKeyboardSelecting, setTagKeyboardSelecting] = useState(false);
  const nameInputRef = useRef<InputRef | null>(null);

  const getJumpUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const jumpUrl = getJumpUrl(value.gameUrl || '');

  useEffect(() => {
    if (!autoFocusName) return;
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus({ cursor: 'end' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [autoFocusName]);

  const updateField = <K extends keyof EditableGame>(
    key: K,
    fieldValue: EditableGame[K]
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const handleThumbnailsChange = (nextThumbnails: string[]) => {
    onChange({
      ...value,
      thumbnails: nextThumbnails,
      thumbnail: getPrimaryThumbnail(nextThumbnails, ''),
    });
  };

  const appendTagId = (tagId: string) => {
    if (!tagId || value.tags.includes(tagId)) return;
    updateField('tags', [...value.tags, tagId]);
  };

  const handleCreateTagFromInput = async () => {
    const keyword = tagSearchValue.trim();
    if (!keyword || creatingTag) return;

    const matchedTag = tags.find(
      (tag) => tag.name.trim().toLowerCase() === keyword.toLowerCase()
    );
    if (matchedTag) {
      appendTagId(matchedTag.id);
      setTagSearchValue('');
      return;
    }

    if (!onCreateTag) return;

    setCreatingTag(true);
    try {
      const createdTagId = await onCreateTag(keyword);
      if (createdTagId) {
        appendTagId(createdTagId);
      }
      setTagSearchValue('');
    } finally {
      setCreatingTag(false);
    }
  };

  const getCopyTextFromRichContent = (richContent: string) => {
    const container = document.createElement('div');
    container.innerHTML = richContent || '';
    return (container.innerText || container.textContent || '').trim();
  };

  const getMarkdownFromRichContent = (richContent: string) => {
    const container = document.createElement('div');
    container.innerHTML = richContent || '';

    const renderChildren = (node: ParentNode): string =>
      Array.from(node.childNodes).map((child) => nodeToMarkdown(child)).join('');

    const resolveCodeBlockLanguage = (preElement: HTMLElement): string => {
      const codeElement = preElement.querySelector('code');

      const attrLanguage =
        preElement.getAttribute('data-language') ||
        codeElement?.getAttribute('data-language') ||
        preElement.getAttribute('language') ||
        codeElement?.getAttribute('language') ||
        '';

      if (attrLanguage.trim()) {
        return attrLanguage.trim().toLowerCase();
      }

      const classNames = `${preElement.className} ${codeElement?.className || ''}`;
      const match = classNames.match(/(?:^|\s)(?:language|lang)-([a-z0-9#+-]+)/i);
      return match?.[1]?.toLowerCase() || '';
    };

    const nodeToMarkdown = (node: ChildNode): string => {
      if (node.nodeType === 3) {
        return node.textContent || '';
      }

      if (node.nodeType !== 1) return '';

      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (tag === 'br') return '\n';
      if (tag === 'hr') return '\n---\n\n';

      if (tag === 'strong' || tag === 'b') {
        const inner = renderChildren(element).trim();
        return inner ? `**${inner}**` : '';
      }

      if (tag === 'em' || tag === 'i') {
        const inner = renderChildren(element).trim();
        return inner ? `*${inner}*` : '';
      }

      if (tag === 'code' && element.parentElement?.tagName.toLowerCase() !== 'pre') {
        const inner = (element.textContent || '').replace(/`/g, '\\`');
        return inner ? `\`${inner}\`` : '';
      }

      if (tag === 'pre') {
        const codeElement = element.querySelector('code');
        const code = (codeElement?.textContent || element.textContent || '').replace(/\n+$/, '');
        const language = resolveCodeBlockLanguage(element);
        const fenceHeader = language ? `\`\`\`${language}` : '```';
        return `\n${fenceHeader}\n${code}\n\`\`\`\n\n`;
      }

      if (tag === 'a') {
        const href = element.getAttribute('href') || '';
        const text = renderChildren(element).trim() || href;
        if (!href) return text;
        return `[${text}](${href})`;
      }

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const level = Number(tag.slice(1));
        const inner = renderChildren(element).trim();
        return inner ? `${'#'.repeat(level)} ${inner}\n\n` : '';
      }

      if (tag === 'blockquote') {
        const inner = renderChildren(element).trim();
        if (!inner) return '';
        const lines = inner.split('\n').map((line) => (line ? `> ${line}` : '>'));
        return `${lines.join('\n')}\n\n`;
      }

      if (tag === 'ul') {
        const items = Array.from(element.children)
          .filter((child) => child.tagName.toLowerCase() === 'li')
          .map((li) => `- ${renderChildren(li).trim()}`)
          .join('\n');
        return items ? `${items}\n\n` : '';
      }

      if (tag === 'ol') {
        const items = Array.from(element.children)
          .filter((child) => child.tagName.toLowerCase() === 'li')
          .map((li, index) => `${index + 1}. ${renderChildren(li).trim()}`)
          .join('\n');
        return items ? `${items}\n\n` : '';
      }

      if (tag === 'li') {
        return renderChildren(element);
      }

      if (tag === 'p') {
        const inner = renderChildren(element).trim();
        return inner ? `${inner}\n\n` : '\n';
      }

      return renderChildren(element);
    };

    return renderChildren(container)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const copyRichContentWithFallback = async (richContent: string) => {
    const html = String(richContent || '').trim();
    const text = getCopyTextFromRichContent(html);
    const markdown = getMarkdownFromRichContent(html) || text;

    if (!text) {
      message.warning('暂无可复制内容');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        // Fallback for older environments: copy markdown plain text.
        const doc = window.document;
        const textarea = doc.createElement('textarea');
        textarea.value = markdown;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        doc.body.appendChild(textarea);
        textarea.select();
        const copied = doc.execCommand('copy');
        doc.body.removeChild(textarea);

        if (!copied) {
          throw new Error('copy failed');
        }
      }
      message.success('已复制为markdown格式');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ThumbnailPreviewPanel
        name={value.name}
        thumbnails={value.thumbnails}
        onThumbnailsChange={handleThumbnailsChange}
      />

      <div>
        <h3 style={{ color: '#6ee7b7', marginTop: 0, marginBottom: 16 }}>基本信息</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
              游戏名称
            </label>
            <Input
              ref={nameInputRef}
              value={value.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="例如: Hades II"
              style={{
                background: '#161d24',
                border: '1px solid #2d3741',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
              游戏别名
            </label>
            <Select
              mode="tags"
              value={value.aliases}
              onChange={(aliases) => updateField('aliases', normalizeAliases(aliases))}
              style={{ width: '100%' }}
              placeholder="可添加多个别名，输入后回车"
              tokenSeparators={[',', '，']}
            />
          </div>

          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
              平台
            </label>
            <Select
              mode="multiple"
              value={value.platform}
              onChange={(platforms) => updateField('platform', platforms)}
              style={{ width: '100%' }}
              placeholder="选择平台"
              options={allPlatforms.map((platform) => ({ value: platform, label: platform }))}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <label style={{ color: '#94a3b8', fontSize: 12 }}>
              游戏官网 URL
            </label>
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              disabled={!jumpUrl}
              onClick={() => {
                if (!jumpUrl) return;
                window.open(jumpUrl, '_blank', 'noopener,noreferrer');
              }}
              style={{
                color: jumpUrl ? '#6ee7b7' : '#64748b',
                padding: 0,
                height: 22,
              }}
            >
              打开
            </Button>
          </div>
          <Input
            value={value.gameUrl || ''}
            onChange={(event) => updateField('gameUrl', event.target.value)}
            placeholder="https://..."
            style={{
              background: '#161d24',
              border: '1px solid #2d3741',
              color: '#fff',
              fontSize: 12,
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
              评分: {value.rating}
            </label>
            <Slider
              value={value.rating}
              onChange={(rating) => updateField('rating', rating)}
              min={0}
              max={100}
              styles={{
                track: { background: '#6ee7b7' },
                rail: { background: '#2d3741' },
              }}
            />
          </div>

          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
              星级
            </label>
            <Rate
              value={value.stars}
              onChange={(stars) => updateField('stars', stars)}
              style={{ color: '#fbbf24', fontSize: 24 }}
            />
          </div>
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
            标签
          </label>
          <Select
            mode="multiple"
            value={value.tags}
            onChange={(selectedTags) => {
              updateField('tags', selectedTags);
              setTagKeyboardSelecting(false);
            }}
            onSearch={(nextValue) => {
              setTagSearchValue(nextValue);
              setTagKeyboardSelecting(false);
            }}
            searchValue={tagSearchValue}
            onInputKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                setTagKeyboardSelecting(true);
                return;
              }

              if (event.key !== 'Enter') return;
              if (tagKeyboardSelecting) {
                setTagKeyboardSelecting(false);
                return;
              }
              if (!tagSearchValue.trim()) return;
              event.preventDefault();
              event.stopPropagation();
              void handleCreateTagFromInput();
            }}
            onBlur={() => setTagKeyboardSelecting(false)}
            style={{ width: '100%' }}
            placeholder="选择标签，输入后回车可新建"
            loading={creatingTag}
            options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
          />
        </div>
      </div>

      <div>
        <h3 style={{ color: '#6ee7b7', marginTop: 0, marginBottom: 16 }}>游戏简介</h3>
        <TextArea
          value={value.synopsis}
          onChange={(event) => updateField('synopsis', event.target.value)}
          rows={4}
          placeholder="简短描述..."
          style={{
            background: '#161d24',
            border: '1px solid #2d3741',
            color: '#fff',
          }}
        />
      </div>

      {showTagInfo && (
        <div>
          <h3 style={{ color: '#6ee7b7', marginBottom: 16 }}>标签信息</h3>
          {gameTags.length === 0 ? (
            <div
              style={{
                background: '#1e262e',
                borderRadius: 8,
                padding: 40,
                textAlign: 'center',
                color: '#94a3b8',
                border: '1px solid #2d3741',
              }}
            >
              暂无标签，请为游戏添加标签后查看标签信息
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {gameTags.map((tag) => {
                const isExpanded = expandedTagId === tag.id;
                return (
                  <div
                    key={tag.id}
                    style={{
                      background: '#1e262e',
                      borderRadius: 8,
                      border: isExpanded ? '1px solid #6ee7b7' : '1px solid #2d3741',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => onTagClick?.(tag.id)}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: onTagClick ? 'pointer' : 'default',
                        background: isExpanded ? 'rgba(110, 231, 183, 0.1)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: 'rgba(110, 231, 183, 0.15)',
                            color: '#6ee7b7',
                            padding: '4px 12px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {tag.name}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                          点击查看详情
                        </span>
                      </div>
                      <EyeOutlined
                        style={{
                          color: isExpanded ? '#6ee7b7' : '#64748b',
                          fontSize: 16,
                          transition: 'all 0.2s',
                        }}
                      />
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          borderTop: '1px solid #2d3741',
                          maxHeight: 'min(42vh, 360px)',
                          overflowY: 'auto',
                          padding: '12px 16px 16px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginBottom: 8,
                          }}
                        >
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => {
                              void copyRichContentWithFallback(tag.description);
                            }}
                          >
                            Markdown
                          </Button>
                        </div>
                        <TipTapRenderer content={tag.description} plain />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
