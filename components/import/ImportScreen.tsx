'use client';

import { useRef, useState } from 'react';
import styles from './import.module.css';

type Props = {
  onSubmitText: (text: string, origin: 'line' | 'prose') => void;
  onUploadFile: (file: File) => void | Promise<void>;
  uploading: boolean;
  error: string | null;
};

/** M4 — paste/upload. Split from ConfirmList so the two screens can each be their
 * own step (the caller decides whether that's two routes or one, see ImportFlow). */
export function ImportScreen({ onSubmitText, onUploadFile, uploading, error }: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (origin: 'line' | 'prose') => {
    if (!text.trim()) return;
    onSubmitText(text, origin);
    setText('');
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText((t) => (t ? `${t}\n${clip}` : clip));
    } catch {
      // Permission denied, or the API isn't available — the textarea is always
      // there as the manual fallback, so this is silent rather than an error.
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await onUploadFile(file);
  };

  return (
    <div className={styles.importScreen}>
      <h1>Add places</h1>

      <label htmlFor="import-text" className={styles.label}>
        One place per line
      </label>
      <textarea
        id="import-text"
        className={styles.textarea}
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.importActions}>
        <button type="button" className="on-accent" disabled={!text.trim()} onClick={() => submit('line')}>
          Add places
        </button>
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Reading file…' : 'Upload file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.md,.txt"
          className="sr-only"
          onChange={onFileChange}
        />
        <button type="button" onClick={pasteFromClipboard}>
          Paste from clipboard
        </button>
      </div>

      <button
        type="button"
        className={styles.scanBtn}
        disabled={!text.trim()}
        aria-describedby="scan-hint"
        onClick={() => submit('prose')}
      >
        Scan text for places
      </button>
      <p id="scan-hint" className={styles.hint}>
        Prose works too — we&rsquo;ll look for place names and you confirm the matches.
      </p>
    </div>
  );
}
