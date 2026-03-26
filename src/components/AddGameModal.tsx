import { useEffect, useMemo, useState } from 'react';
import { Drawer, Space, Button, message } from 'antd';
import { useGameStore } from '../store';
import { PLATFORMS, type EditableGame } from '../types';
import { GameEditorForm } from './GameEditorForm';
import {
    getPrimaryThumbnail,
    sanitizeThumbnailUrls,
} from '../utils/thumbnails';

interface AddGameModalProps {
    open: boolean;
    onClose: () => void;
}

const buildInitialGame = (): EditableGame => ({
    name: '',
    aliases: [],
    thumbnail: '',
    thumbnails: [],
    gameUrl: '',
    platform: [],
    rating: 0,
    stars: 1,
    synopsis: '',
    tags: [],
});

export const AddGameModal = ({ open, onClose }: AddGameModalProps) => {
    const { tags, addGame, addTag, customPlatforms, deletedPlatforms } = useGameStore();
    const [expandedTagId, setExpandedTagId] = useState<string | null>(null);

    const allPlatforms = useMemo(() => {
        const availableBuiltIns = PLATFORMS.filter((platform) => !deletedPlatforms.includes(platform));
        return [...availableBuiltIns, ...customPlatforms];
    }, [customPlatforms, deletedPlatforms]);

    const [draftGame, setDraftGame] = useState<EditableGame>(() =>
        buildInitialGame()
    );

    useEffect(() => {
        if (open) {
            setDraftGame(buildInitialGame());
            setExpandedTagId(null);
        }
    }, [open, allPlatforms]);

    const handleTagClick = (tagId: string) => {
        setExpandedTagId((currentTagId) => (currentTagId === tagId ? null : tagId));
    };

    const handleCreateTag = async (rawName: string) => {
        const name = rawName.trim();
        if (!name) return null;

        const existingTag = tags.find(
            (tag) => tag.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (existingTag) {
            return existingTag.id;
        }

        try {
            await addTag(name, '');
            const latestTags = useGameStore.getState().tags;
            const createdTag =
                latestTags.find((tag) => tag.name.trim().toLowerCase() === name.toLowerCase()) ??
                null;
            if (createdTag) {
                message.success(`已创建标签：${createdTag.name}`);
                return createdTag.id;
            }
            message.success('标签已创建');
            return null;
        } catch (error) {
            message.error(error instanceof Error ? error.message : '标签创建失败');
            return null;
        }
    };

    const handleCancel = () => {
        setDraftGame(buildInitialGame());
        setExpandedTagId(null);
        onClose();
    };

  const handleSubmit = async () => {
    if (!draftGame.name.trim()) {
      message.warning('请输入游戏名称');
      return;
        }

        if (draftGame.platform.length === 0) {
            message.warning('请选择平台');
            return;
        }

        const normalizedThumbnails = sanitizeThumbnailUrls(draftGame.thumbnails);
        const thumbnail = getPrimaryThumbnail(normalizedThumbnails, draftGame.thumbnail || '');
        const thumbnails =
            normalizedThumbnails.length > 0 ? normalizedThumbnails : [];

    try {
      await addGame({
        name: draftGame.name.trim(),
        aliases: draftGame.aliases,
        thumbnail,
        thumbnails,
        gameUrl: draftGame.gameUrl?.trim() || '',
        platform: draftGame.platform,
        rating: draftGame.rating,
        stars: draftGame.stars,
        synopsis: draftGame.synopsis,
        tags: draftGame.tags,
      });

      message.success('游戏添加成功');
      setDraftGame(buildInitialGame());
      setExpandedTagId(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '游戏添加失败');
    }
  };

    return (
        <Drawer
            title={
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                    添加新游戏
                </span>
            }
            placement="right"
            open={open}
            onClose={handleCancel}
            width="min(540px, 100vw)"
            styles={{
                body: { background: '#12181d', color: '#fff', padding: 24 },
                header: { background: '#1e262e', borderBottom: '1px solid #2d3741' },
            }}
            extra={
                <Space>
                    <Button onClick={handleCancel} style={{ color: '#94a3b8' }}>
                        取消
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleSubmit}
                        style={{ background: '#6ee7b7', borderColor: '#6ee7b7', color: '#12181d' }}
                    >
                        添加
                    </Button>
                </Space>
            }
        >
            <GameEditorForm
                value={draftGame}
                onChange={setDraftGame}
                tags={tags}
                allPlatforms={allPlatforms}
                showTagInfo
                expandedTagId={expandedTagId}
                onTagClick={handleTagClick}
                onCreateTag={handleCreateTag}
                autoFocusName={open}
            />
        </Drawer>
    );
};
