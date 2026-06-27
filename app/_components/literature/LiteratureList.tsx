"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { OpTag } from "@/lib/types";
import { getArticleList } from "@/lib/api/op";
import { tagIconMap } from "./tag-icons";
import LiteratureCard from "./LiteratureCard";
import Loading from "../common/Loading";

const staggerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export default function LiteratureList() {
  const [tags, setTags] = useState<OpTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getArticleList();
        setTags(data.rows);
      } catch {
        setTags([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Literature</div>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Poetry, prose, and creative writing.</p>

      {loading ? (
        <Loading />
      ) : tags.length === 0 ? (
        <p className="text-center py-10 text-slate-400">Tomcat data unavailable.</p>
      ) : tags.map((tag, idx) => (
        <section key={tag.id} className={idx < tags.length - 1 ? "mb-12" : ""}>
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            {(() => {
              const info = tagIconMap[tag.name];
              if (info) {
                const { Icon, color } = info;
                return <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.5} />;
              }
              return <span className="text-indigo-400">◇</span>;
            })()} {tag.name}
          </h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {tag.articles.map((article) => (
              <motion.div key={article.id} variants={cardVariants}>
                <LiteratureCard item={article} />
              </motion.div>
            ))}
          </motion.div>
          {idx < tags.length - 1 && (
            <div className="mt-8 h-px bg-gradient-to-r from-transparent via-indigo-300/50 dark:via-indigo-500/30 to-transparent" />
          )}
        </section>
      ))}
    </div>
  );
}
