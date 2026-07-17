import type { ReactNode } from "react";
import PersonalNav from "./_components/PersonalNav";

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PersonalNav />
      {children}
    </>
  );
}
