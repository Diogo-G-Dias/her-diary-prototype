/* eslint-disable @next/next/no-img-element */
// Character portrait. Falls back to the gradient circle if the image is missing.
export default function Avatar({ src, small, hue }: { src?: string; small?: boolean; hue?: string }) {
  return (
    <span className={`avatar ${small ? 'sm' : ''} ${hue ?? ''}`} aria-hidden>
      {src && <img src={src} alt="" />}
    </span>
  );
}
