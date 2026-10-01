import { Link, useLocation } from 'react-router';

/** Temporary placeholder a screen task replaces. */
export function StubPage({ name }: { name: string }) {
  const { pathname, search } = useLocation();
  return (
    <main
      data-testid={`stub-${name}`}
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeContent: 'center',
        gap: 12,
        background: 'var(--ground)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32, margin: 0 }}>
        {name}
      </h1>
      <p style={{ color: 'var(--muted)', fontWeight: 600, margin: 0 }}>
        {pathname}
        {search}
      </p>
      <Link to="/">Back to Today</Link>
    </main>
  );
}
