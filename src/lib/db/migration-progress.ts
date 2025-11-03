import { writable } from 'svelte/store';

export interface MigrationProgress {
	isRunning: boolean;
	stage: 'idle' | 'downloading' | 'creating-table' | 'building-fts' | 'building-indexes' | 'complete';
	percentage: number;
	message: string;
	downloadProgress?: {
		loaded: number;
		total: number;
	};
}

const initialState: MigrationProgress = {
	isRunning: false,
	stage: 'idle',
	percentage: 0,
	message: ''
};

export const migrationProgress = writable<MigrationProgress>(initialState);
