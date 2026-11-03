# Top11.ChromeExtension

Відстежує гравців на аукціоні Top Eleven (web, Unity WebGL) через перехоплення websocket `wss://weaver.prod.topeleven.com/websocket`.

## Збірка
```
npm i -D -E esbuild@0.28.2 typescript@5.4.4 @types/chrome
npm run build      # -> dist/
npm run watch      # перезбірка при змінах
npm run typecheck
```

## Встановлення
1. `chrome://extensions` → **Developer mode**.
2. **Load unpacked** → папка `Top11.ChromeExtension/dist`.
3. Після змін: `npm run build` (або watch) → ↻ на картці розширення → перезавантажити вкладку гри.

## Структура
- `src/content/inject.ts` — MAIN world, `document_start`: хук WebSocket, буфер кадрів, звук, `window.__t11`.
- `src/content/proto.ts` — декодер protobuf без схеми.
- `src/content/bridge.ts` — міст chrome.storage/runtime ↔ сторінка.
- `src/popup/popup.ts` + `static/popup.html` — Старт/Стоп, фільтри, дамп.
- `src/shared/messages.ts` — спільні типи.
- `static/manifest.json` — копіюється в dist.

## Дебаг у консолі вкладки гри
- `__t11.find('Bitarov')` — кадри, де є рядок, і шляхи полів.
- `__t11.state.frames[i].dec.m` — розібраний кадр.
- `__t11.dump()` — скачати всі кадри в JSON.
