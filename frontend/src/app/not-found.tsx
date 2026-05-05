import Link from 'next/link';
import '../styles/notfound.scss';

const Illustration = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 300 250"
    preserveAspectRatio="xMidYMid meet"
    style={{ maxWidth: '300px', margin: 'auto', display: 'block' }}
  >
    <defs>
      <clipPath id="clip_text">
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="120"
          fontWeight="bold"
        >
          404
        </text>
      </clipPath>
    </defs>
    <text
      x="50%"
      y="50%"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize="120"
      fontWeight="bold"
      fill="#000000"
    >
      404
    </text>
    <path
      d="M -10 110 L 310 140"
      stroke="#FF5252"
      strokeWidth="50"
      strokeDasharray="1, 28"
      clipPath="url(#clip_text)"
      strokeLinecap="round"
    />
  </svg>
);

export default function NotFound() {
  return (
    <div className="wrapper">
      <div className="container">
        <Illustration />
        <p className="comment">ページが見つかりませんでした。</p>
        <Link href="/" className="back-button">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
