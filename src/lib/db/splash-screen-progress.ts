import { writable } from 'svelte/store';

export interface SplashScreenProgress {
	isRunning: boolean;
	stage: 'idle' | 'init' | 'downloading' | 'creating-table' | 'building-fts' | 'building-indexes' | 'complete';
	percentage: number;
	message: string;
	downloadProgress?: {
		loaded: number;
		total: number;
	};
}

const initialState: SplashScreenProgress = {
	isRunning: true,
	stage: 'idle',
	percentage: 0,
	message: 'Cargando...'
};

export const splashScreenProgress = writable<SplashScreenProgress>(initialState);
