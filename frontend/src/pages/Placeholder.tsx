export default function Placeholder({ title, owner }: { title: string; owner: string }) {
  return <div style={{ padding: 16 }}><h2>{title}</h2><p>TODO ({owner})</p></div>;
}
