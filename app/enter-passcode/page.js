import { checkPasscode } from '@/lib/auth';

export default function PasscodePage({ searchParams }) {
  const hasError = searchParams?.error;
  const next = searchParams?.next || '/';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAF8F4',
        fontFamily: "'IBM Plex Sans', -apple-system, Helvetica, Arial, sans-serif",
        padding: 20,
      }}
    >
      <form
        action={checkPasscode}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4DED2',
          borderRadius: 12,
          padding: 32,
          width: '100%',
          maxWidth: 340,
        }}
      >
        <h1
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontWeight: 600,
            fontSize: 22,
            margin: '0 0 6px',
            color: '#20262B',
          }}
        >
          New Roadmap
        </h1>
        <p style={{ color: '#75695C', fontSize: 13.5, margin: '0 0 20px' }}>
          Enter the passcode to continue.
        </p>

        <input type="hidden" name="next" value={next} />

        <input
          type="password"
          name="passcode"
          autoFocus
          placeholder="Passcode"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #D6CEBF',
            borderRadius: 7,
            fontSize: 14,
            marginBottom: 12,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        {hasError && (
          <p style={{ color: '#A8402F', fontSize: 13, margin: '0 0 12px' }}>
            Incorrect passcode, try again.
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#20262B',
            color: '#FAF8F4',
            border: 'none',
            borderRadius: 7,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
