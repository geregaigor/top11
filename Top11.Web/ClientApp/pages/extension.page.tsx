import { computed, defineComponent, onMounted, ref } from 'vue';
import { NAlert, NButton, NCard, NH1, NProgress, NSpace, NText, useMessage } from 'naive-ui';
import styles from './extension.page.module.css';

// File System Access API — є в Chrome/Edge на компʼютері, нема в lib.dom TS
declare global {
  interface Window { showDirectoryPicker?(o?: { id?: string; mode?: 'readwrite' }): Promise<FileSystemDirectoryHandle> }
}

const CODE = '/ext/code';
const EXT_NAME = 'Top11 Auction Watcher';

interface Published {
  version: string;
  built: string;
  shell: { latest: string; files: Record<string, string> };
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  let s = '';
  for (const c of h) s += String.fromCharCode(c);
  return btoa(s);
}

async function writeFile(root: FileSystemDirectoryHandle, path: string, data: ArrayBuffer): Promise<void> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

/** Папка порожня або вже містить це розширення (тоді оновлюємо поверх) */
async function checkFolder(dir: FileSystemDirectoryHandle): Promise<string | null> {
  const names: string[] = [];
  for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
  if (!names.length) return null;
  if (names.includes('manifest.json')) {
    try {
      const m = JSON.parse(await (await (await dir.getFileHandle('manifest.json')).getFile()).text()) as { name?: string };
      if (m.name === EXT_NAME) return null;
      return `У цій папці інше розширення («${m.name ?? '?'}»). Вибери порожню папку.`;
    } catch { /* */ }
  }
  return 'Папка не порожня. Створи нову порожню папку (наприклад Документи\\Top11Extension) і вибери її.';
}

export const ExtensionPage = defineComponent({
  setup() {
    const message = useMessage();
    const info = ref<Published | null>(null);
    const loadError = ref('');
    const busy = ref(false);
    const progress = ref(0);
    const status = ref('');
    const done = ref(false);
    const supported = typeof window.showDirectoryPicker === 'function';

    onMounted(async () => {
      try {
        const r = await fetch(`${CODE}/payload.json`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`${r.status}`);
        const { manifest } = await r.json() as { manifest: string };
        const m = JSON.parse(manifest) as Partial<Published>;
        // старий формат (до /ext/code/shell) — ще не перепубліковано
        if (!m.shell?.files) throw new Error('старий формат — запусти npm run publish у Top11.ChromeExtension');
        info.value = m as Published;
      } catch (e) {
        loadError.value = `Розширення ще не опубліковано на сайті (${(e as Error).message})`;
      }
    });

    const fileCount = computed(() => Object.keys(info.value?.shell?.files ?? {}).length);

    async function install() {
      if (!info.value?.shell?.files || !window.showDirectoryPicker) return;
      let dir: FileSystemDirectoryHandle;
      try {
        dir = await window.showDirectoryPicker({ id: 'top11-ext', mode: 'readwrite' });
      } catch {
        return; // скасували вибір
      }
      busy.value = true;
      done.value = false;
      progress.value = 0;
      try {
        const bad = await checkFolder(dir);
        if (bad) { message.error(bad, { duration: 8000 }); return; }
        const entries = Object.entries(info.value.shell.files)
          // manifest.json останнім: якщо запис обірветься, Chrome не побачить «нову» версію з неповними файлами
          .sort(([a], [b]) => Number(a === 'manifest.json') - Number(b === 'manifest.json'));
        let i = 0;
        for (const [path, hash] of entries) {
          status.value = path;
          const r = await fetch(`${CODE}/shell/${path}`, { cache: 'no-store' });
          if (!r.ok) throw new Error(`${path}: ${r.status}`);
          const data = await r.arrayBuffer();
          if (await sha256(data) !== hash) throw new Error(`${path}: файл на сайті змінився під час завантаження — спробуй ще раз`);
          await writeFile(dir, path, data);
          progress.value = Math.round(++i / entries.length * 100);
        }
        status.value = '';
        done.value = true;
        message.success(`Готово: ${entries.length} файлів у папці «${dir.name}»`);
      } catch (e) {
        message.error(`Не вдалося: ${(e as Error).message}`, { duration: 8000 });
      } finally {
        busy.value = false;
      }
    }

    const copy = async (text: string) => {
      await navigator.clipboard.writeText(text);
      message.success(`Скопійовано: ${text}`);
    };

    return () => (
      <div class={styles.page}>
        <NH1>Розширення Top11 для Chrome</NH1>
        <NText depth={3}>
          Слухає гру Top Eleven у браузері: аукціон з фільтрами, звуком і талантом (К), твоя команда з навичками,
          експорт складу на цей сайт. Оновлюється саме.
        </NText>

        {!supported && <NAlert type="warning" class={styles.block} title="Потрібен Chrome або Edge на компʼютері">
          Цей браузер не вміє записувати файли в папку. Відкрий сторінку в Google Chrome на Windows/Mac.
        </NAlert>}
        {loadError.value && <NAlert type="error" class={styles.block}>{loadError.value}</NAlert>}

        <NCard class={styles.block} title="1. Завантаж файли в папку">
          <ol class={styles.steps}>
            <li>Створи <b>нову порожню папку</b>, наприклад <code>Документи\Top11Extension</code>.
              Не вибирай Робочий стіл чи Завантаження цілком — Chrome їх не дозволяє.</li>
            <li>Натисни кнопку нижче, вибери цю папку і дозволь редагування (<b>«Змінити файли»</b> / <i>Edit files</i>).</li>
          </ol>
          <NSpace align="center">
            <NButton type="primary" size="large" disabled={!supported || !info.value} loading={busy.value} onClick={install}>
              Завантажити розширення в папку
            </NButton>
            {info.value?.shell && <NText depth={3}>версія {info.value.shell.latest} · {fileCount.value} файлів</NText>}
          </NSpace>
          {busy.value && <div class={styles.block}>
            <NProgress type="line" percentage={progress.value} />
            <NText depth={3} class={styles.small}>{status.value}</NText>
          </div>}
          {done.value && <NAlert type="success" class={styles.block}>Файли на місці — переходь до кроку 2.</NAlert>}
          <NText depth={3} class={styles.small}>
            Папку потім не видаляй і не переміщуй: Chrome завантажує розширення саме з неї.
          </NText>
        </NCard>

        <NCard class={styles.block} title="2. Підключи в Chrome">
          <ol class={styles.steps}>
            <li>Відкрий нову вкладку і встав адресу{' '}
              <code class={styles.link} onClick={() => copy('chrome://extensions')}>chrome://extensions</code>{' '}
              <NButton size="tiny" secondary onClick={() => copy('chrome://extensions')}>копіювати</NButton>
              <div class={styles.small}>(посилання на chrome:// з сайту не відкриваються — тільки вручну)</div>
            </li>
            <li>Справа вгорі увімкни <b>«Режим розробника»</b> (<i>Developer mode</i>).</li>
            <li>Натисни <b>«Завантажити розпаковане розширення»</b> (<i>Load unpacked</i>) і вибери ту саму папку.</li>
            <li>На картці <b>Top11 Auction Watcher</b> натисни <b>«Докладніше»</b> (<i>Details</i>) і увімкни
              <b> «Дозволити скрипти користувача»</b> (<i>Allow User Scripts</i>). Без цього розширення не бачитиме гру.</li>
            <li>За бажанням: іконка пазла на панелі Chrome → шпилька біля Top11, щоб іконка <b>T</b> була завжди під рукою.</li>
          </ol>
        </NCard>

        <NCard class={styles.block} title="3. Користуйся">
          <ol class={styles.steps}>
            <li>Відкрий гру <a href="https://www.topeleven.com/play" target="_blank">topeleven.com/play</a> (якщо вже відкрита — онови сторінку F5).</li>
            <li>Натисни іконку <b>T</b> — поруч відкриється вкладка розширення: «Аукціон», «Моя команда».</li>
            <li>Індикатор справа вгорі має бути <span class={styles.green}>зеленим «Звʼязок є»</span>.</li>
          </ol>
          <NText depth={3} class={styles.small}>
            Chrome при запуску може показувати «Вимкніть розширення в режимі розробника» — просто закрий це повідомлення.
          </NText>
        </NCard>

        <NCard class={styles.block} title="Оновлення">
          <ul class={styles.steps}>
            <li>Звичайні оновлення приходять самі: розширення перевіряє сайт щоразу, коли відкриваєш гру, і за потреби саме один раз її перезавантажує.</li>
            <li>Якщо на сторінці розширення зʼявився синій банер — натисни <b>«Оновити розширення»</b> і вибери ту саму папку.</li>
            <li>Щось зламалось — завантаж файли тут ще раз у ту саму папку, потім ↻ на картці Top11 у <code>chrome://extensions</code>.</li>
          </ul>
        </NCard>
      </div>
    );
  },
});
