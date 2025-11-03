import { writable } from 'svelte/store';

export interface SplashScreenProgress {
	enabled: boolean; // Whether to show splash screen (false if data is cached)
	isRunning: boolean;
	stage: 'idle' | 'init' | 'creating-table' | 'building-fts' | 'building-indexes' | 'complete';
	percentage: number;
	message: string;
	downloadProgress?: {
		loaded: number;
		total: number;
	};
}

const initialState: SplashScreenProgress = {
	enabled: false,
	isRunning: false,
	stage: 'idle',
	percentage: 0,
	message: 'Cargando...'
};

export const splashScreenProgress = writable<SplashScreenProgress>(initialState);
