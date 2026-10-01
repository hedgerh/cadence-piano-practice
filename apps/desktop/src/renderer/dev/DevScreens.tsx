// /dev/screens/:name — placeholder previews until the screens land (Tasks 07–15).
// Each screen task replaces its entry here with the real screen fed by its fixture.
import { Link, useParams } from 'react-router';
import styles from './Dev.module.css';
import { screenFixtures, type ScreenName } from './fixtures';

function isScreenName(name: string | undefined): name is ScreenName {
  return name !== undefined && name in screenFixtures;
}

export function DevScreens() {
  const { name } = useParams();
  const known = isScreenName(name);
  return (
    <div className={styles.page} data-testid="dev-screens">
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>
            {known ? screenFixtures[name].design : `Unknown screen “${name ?? ''}”`}
          </h1>
          <p className={styles.lede}>
            Placeholder: this screen arrives in Tasks 07–15. Fixture data below.{' '}
            <Link to="/dev/components">Component gallery</Link>
          </p>
          <div className={styles.links}>
            {(Object.keys(screenFixtures) as ScreenName[]).map((n) => (
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
