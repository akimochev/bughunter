import Link from "next/link";
import { Bug, ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-brand">
          <Bug size={17} /> BugHunter<span className="footer-separator">/</span>
          <span>Практика Python с детективным сюжетом</span>
        </span>
        <Link href="/missions">
          К делам <ArrowUpRight size={15} />
        </Link>
      </div>
    </footer>
  );
}
