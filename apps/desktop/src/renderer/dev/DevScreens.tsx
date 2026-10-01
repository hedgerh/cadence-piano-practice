// /dev/screens/:name — screen previews fed by design fixtures.
// Real screens register themselves via `features/<feature>/dev.tsx` (see screenRegistry.ts);
// names without a registered screen fall back to a fixture dump.
import { Link, useParams } from 'react-router';
import styles from './Dev.module.css';
import { screenFixtures, type ScreenName } from './fixtures';
import { devScreens } from './screenRegistry';

function isScreenName(name: string | undefined): name is ScreenName {
  return name !== undefined && name in screenFixtures;
}

export function DevScreens() {
  const { name } = useParams();
  const Screen = name !== undefined ? devScreens[name] : undefined;
  if (Screen) return <Screen />;

  const known = isScreenName(name);
  const names = Array.from(new Set([...Object.keys(screenFixtures), ...Object.keys(devScreens)]));
  return (
    <div className={styles.page} data-testid="dev-screens">
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>
            {known ? screenFixtures[name].design : `Unknown screen “${name ?? ''}”`}
          </h1>
          <p className={styles.lede}>
            No screen registered for this name yet; fixture data below.{' '}
            <Link to="/dev/components">Component gallery</Link>
          </p>
          <div className={styles.links}>
            {names.map((n) => (
              <Link key={n} to={`/dev/screens/${n}`} aria-current={n === name ? 'page' : undefined}>
                {n}
              </Link>
            ))}
          </div>
        </div>
        {known && (
          <pre className={styles.pre} data-testid="fixture-json">
            {JSON.stringify(screenFixtures[name].data, null, 2)}
          </pre>
        )}
      </main>
    </div>
  );
}
