/** Logo: a closed Bible with a cross on its cover. */
export function Logo() {
  return (
    <svg class="logo" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="var(--accent)" />
      {/* pages */}
      <path d="M14 11h20a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H14z" fill="var(--accent-ink)" opacity="0.55" />
      {/* cover */}
      <path d="M12 12a3 3 0 0 1 3-3h18a2 2 0 0 1 2 2v23a2 2 0 0 1-2 2H15a3 3 0 0 0 0 6h-0a3 3 0 0 1-3-3z" fill="var(--accent-ink)" />
      <path d="M15 36h20v3H15a1.5 1.5 0 0 1 0-3z" fill="var(--accent-ink)" opacity="0.55" />
      {/* cross */}
      <path d="M23.5 14v15M18.5 19h10" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  );
}
