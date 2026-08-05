import type { WatchStatus } from '../types';
import { COLORS } from './theme';

export const WATCH_STATUS_META: Record<WatchStatus, { label: string; color: string; icon: string }> = {
    planned: {
        label: 'Запланировано',
        color: COLORS.statusPlanned,
        icon: 'bookmark-outline',
    },
    watching: {
        label: 'Смотрю',
        color: COLORS.statusWatching,
        icon: 'play-outline',
    },
    completed: {
        label: 'Просмотрено',
        color: COLORS.statusCompleted,
        icon: 'checkmark-circle-outline',
    },
    dropped: {
        label: 'Брошено',
        color: COLORS.statusDropped,
        icon: 'close-circle-outline',
    },
};

export const WATCH_STATUS_OPTIONS = (Object.keys(WATCH_STATUS_META) as WatchStatus[]).map(
    (status) => ({
        value: status,
        ...WATCH_STATUS_META[status],
    }),
);