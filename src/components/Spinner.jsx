export default function Spinner({ size = 16 }) {
  const s = { width: size, height: size };
  return (
    <span
      aria-label="Loading"
      style={{
        ...s,
        display: "inline-block",
        border: `${size/8}px solid rgba(0,0,0,.15)`,
        borderTopColor: "#1d4ed8",
        borderRadius: "50%",
        animation: "spin 0.9s linear infinite",
      }}
    />
  );
}
