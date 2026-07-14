import { siteConfig } from "@/lib/siteConfig";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto py-8 text-center">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        &copy; {year} {siteConfig.navTitle}. Built with Next.js & Tailwind CSS.
      </p>
    </footer>
  );
}
