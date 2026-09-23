import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-links">
        <Link href="/#about">About</Link>
        <span className="sep">/</span>
        <Link href="/#experience">Experience</Link>
        <span className="sep">/</span>
        <Link href="/#projects">Projects</Link>
        <span className="sep">/</span>
        <Link href="/blog">Blog</Link>
        <span className="sep">/</span>
        <Link href="/gallery">Gallery</Link>
      </div>
      <ThemeToggle />
    </nav>
  );
}
