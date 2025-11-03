import { writable } from 'svelte/store';

export interface DatabaseLoading {
	isRunning: boolean;
	percentage: number;
	message: string;
}

const initialState: DatabaseLoading = {
	isRunning: true,
	percentage: 0,
	message: 'Cargando...'
};

export const databaseLoading = writable<DatabaseLoading>(initialState);
