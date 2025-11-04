<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { createForm } from '@tanstack/svelte-form';
	import { z } from 'zod';
	import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from '@lucide/svelte';

	const optionalText = () =>
		z
			.string()
			.trim()
			.optional()
			.transform((value) => (value && value.length > 0 ? value : undefined));

	const schema = z.object({
		word: z.string().trim().min(1, 'La palabra es obligatoria.'),
		definition: z.string().trim().min(10, 'Describe la palabra con al menos 10 caracteres.'),
		example: optionalText(),
		author: z.string(),
		website: z
			.string()
			.refine(
				(value) => !value || /^https?:\/\//i.test(value),
				'Ingresa una URL válida (incluye https://).'
			)
	});

	type FormValues = z.input<typeof schema>;
	const initialValues: FormValues = {
		word: '',
		definition: '',
		example: '',
		author: '',
		website: ''
	};

	let submitStatus = $state<'idle' | 'success' | 'error'>('idle');
	let submitError = $state<string | null>(null);

	const form = createForm(() => ({
		defaultValues: { ...initialValues },
		validators: {
			onChange: schema,
			onSubmit: schema
		},
		onSubmit: async ({ value, formApi }) => {
			submitStatus = 'idle';
			submitError = null;

			if (!env.PUBLIC_WORD_SUBMISSION_WEBHOOK) {
				submitStatus = 'error';
				submitError = 'El webhook no está configurado. Intenta más tarde.';
				return;
			}

			try {
				const parsed = schema.parse(value);
				const payload = {
					word: parsed.word,
					definition: parsed.definition,
					example: parsed.example ?? '',
					createdBy: {
						name: parsed.author,
						website: parsed.website
					},
					submittedAt: new Date().toISOString(),
					source: 'web-form'
				};

				const response = await fetch(env.PUBLIC_WORD_SUBMISSION_WEBHOOK, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
					const message = await response.text();
					throw new Error(message || 'Solicitud rechazada por el servidor.');
				}

				submitStatus = 'success';
				formApi.reset({ ...initialValues });
			} catch (error) {
				console.error('Failed to submit word', error);
				submitStatus = 'error';
				submitError =
					error instanceof Error
						? error.message
						: 'No pudimos enviar la palabra. Intenta nuevamente.';
			}
		}
	}));

	const formState = form.useStore();

	const isSubmitting = $derived(formState.current.isSubmitting);
	const isValid = $derived(formState.current.isValid);
	const disableSubmit = $derived(isSubmitting || !isValid);

	const Field = form.Field;
</script>

<svelte:head>
	<title>Agregar palabra | Monocuco</title>
</svelte:head>

<section class="mx-auto w-full max-w-3xl space-y-3">
	<header class="space-y-3">
		<h1 class="text-3xl font-bold text-base-content">Nueva palabra</h1>
		<p class="text-sm sm:text-md text-base-content/70">
			Comparte palabras del español barranquillero y nosotros nos encargamos de revisarlas antes de
			publicarlas.
		</p>
		<div class="alert bg-base-100 border border-base-200 text-sm text-base-content/80">
			<AlertCircleIcon class="size-5 shrink-0 text-primary" aria-hidden="true" />
			<p class="font-medium text-left text-sm">
				Antes de enviar, revisa las
				<a class="link link-primary" href="/guidelines"> pautas de contenido </a>. En resumen:
				comparte definiciones que otras personas puedan entender y nunca publiques discurso de odio
				ni información personal.
			</p>
		</div>
	</header>

	{#if submitStatus === 'success'}
		<div class="alert alert-success">
			<CheckCircle2Icon class="size-5 shrink-0" aria-hidden="true" />
			<span>¡Gracias! Revisaremos tu aporte lo antes posible.</span>
		</div>
	{:else if submitStatus === 'error'}
		<div class="alert alert-error">
			<AlertCircleIcon class="size-5 shrink-0" aria-hidden="true" />
			<span>{submitError ?? 'No pudimos enviar la palabra. Inténtalo más tarde.'}</span>
		</div>
	{/if}

	<form
		class="card bg-base-100 p-6 shadow-lg space-y-6"
		onsubmit={(event) => {
			event.preventDefault();
			void form.handleSubmit();
		}}
	>
		<div class="grid gap-6">
			<Field name="word">
				{#snippet children(field)}
					<div class="form-control gap-2">
						<label class="label" for="word">
							<span class="label-text font-semibold">Palabra *</span>
						</label>
						<input
							id="word"
							type="text"
							class="input input-bordered w-full"
							placeholder="Ñame"
							value={field.state.value ?? ''}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							onblur={field.handleBlur}
							autocomplete="off"
						/>
						{#if field.state.meta.errors?.length && (field.state.meta.isTouched || formState.current.isSubmitted)}
							<p class="text-sm text-error">{field.state.meta.errors[0]?.message}</p>
						{/if}
					</div>
				{/snippet}
			</Field>

			<Field name="definition">
				{#snippet children(field)}
					<div class="form-control gap-2">
						<label class="label" for="definition">
							<span class="label-text font-semibold">Definición *</span>
						</label>
						<textarea
							id="definition"
							class="textarea textarea-bordered min-h-32 w-full"
							placeholder="Describe el uso o significado en al menos un par de líneas."
							value={field.state.value ?? ''}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							onblur={field.handleBlur}
						></textarea>
						{#if field.state.meta.errors?.length && (field.state.meta.isTouched || formState.current.isSubmitted)}
							<p class="text-sm text-error">{field.state.meta.errors[0]?.message}</p>
						{/if}
					</div>
				{/snippet}
			</Field>

			<Field name="example">
				{#snippet children(field)}
					<div class="form-control gap-2">
						<label class="label" for="example">
							<span class="label-text font-semibold">Ejemplo</span>
						</label>
						<textarea
							id="example"
							class="textarea textarea-bordered min-h-24 w-full"
							placeholder="Comparte una frase que use la palabra (opcional)."
							value={field.state.value ?? ''}
							oninput={(event) => field.handleChange(event.currentTarget.value)}
							onblur={field.handleBlur}
						></textarea>
						{#if field.state.meta.errors?.length && (field.state.meta.isTouched || formState.current.isSubmitted)}
							<p class="text-sm text-error">{field.state.meta.errors[0]?.message}</p>
						{/if}
					</div>
				{/snippet}
			</Field>

			<div class="grid gap-6 md:grid-cols-2">
				<Field name="author">
					{#snippet children(field)}
						<div class="form-control gap-2">
							<label class="label" for="author">
								<span class="label-text font-semibold">Tu nombre *</span>
							</label>
							<input
								id="author"
								type="text"
								class="input input-bordered w-full"
								placeholder="Nombre o alias"
								value={field.state.value ?? ''}
								oninput={(event) => field.handleChange(event.currentTarget.value)}
								onblur={field.handleBlur}
								autocomplete="off"
							/>
							{#if field.state.meta.errors?.length && (field.state.meta.isTouched || formState.current.isSubmitted)}
								<p class="text-sm text-error">{field.state.meta.errors[0]?.message}</p>
							{/if}
						</div>
					{/snippet}
				</Field>

				<Field name="website">
					{#snippet children(field)}
						<div class="form-control gap-2">
							<label class="label" for="website">
								<span class="label-text font-semibold">Sitio web *</span>
							</label>
							<input
								id="website"
								type="url"
								class="input input-bordered w-full"
								placeholder="https://github.com/sjdonado"
								value={field.state.value ?? ''}
								oninput={(event) => field.handleChange(event.currentTarget.value)}
								onblur={field.handleBlur}
								autocomplete="off"
							/>
							{#if field.state.meta.errors?.length && (field.state.meta.isTouched || formState.current.isSubmitted)}
								<p class="text-sm text-error">{field.state.meta.errors[0]?.message}</p>
							{/if}
						</div>
					{/snippet}
				</Field>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-2">
			<button type="submit" class="btn btn-primary" disabled={disableSubmit}>
				{#if isSubmitting}
					<Loader2Icon class="size-4 animate-spin" aria-hidden="true" />
					Enviando...
				{:else}
					Enviar palabra
				{/if}
			</button>
		</div>
	</form>
</section>
