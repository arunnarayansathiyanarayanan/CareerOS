"use client";

import { motion } from "framer-motion";

export type ProfileActivityItem = {
  id: string;
  title: string;
  subtitle: string;
};

export default function ActivityTimeline({
  items,
}: {
  items: ProfileActivityItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Activity will appear as you publish and spotlight projects.
      </p>
    );
  }

  return (
    <ul className="relative min-h-[200px] space-y-5 border-l border-zinc-800 pl-6">
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          className="relative"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06 }}
        >
          <span
            className="absolute -left-[calc(0.25rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border border-zinc-700 bg-indigo-500 shadow-[0_0_0_4px_rgba(9,9,11,0.9)]"
            aria-hidden
          />
          <p className="font-medium text-zinc-100">{item.title}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{item.subtitle}</p>
        </motion.li>
      ))}
    </ul>
  );
}
