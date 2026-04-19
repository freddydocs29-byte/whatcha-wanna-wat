"use client";

import { motion } from "framer-motion";
import { type Meal } from "../data/meals";
import WhyItWorks from "./WhyItWorks";

type Props = {
  meal: Meal;
  pantryMode: boolean;
};

export default function LockedReveal({ meal, pantryMode }: Props) {
  return (
    <div className="pt-8">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="text-sm text-white/45"
      >
        Decision locked
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 text-5xl font-semibold leading-[0.98] tracking-[-0.06em]"
      >
        We&apos;re eating
        <br />
        {meal.name}
        <br />
        tonight.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14, ease: "easeOut" }}
        className="mt-3 text-sm text-white/50"
      >
        Locked in. Come back anytime to cook, order, or change it.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.65, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24, ease: "easeOut" }}
        className="mt-5 max-w-[30ch] text-[15px] leading-7 text-white/65"
      >
        {meal.whyItFits}. {meal.description}
      </motion.p>

      <WhyItWorks meal={meal} pantryMode={pantryMode} />
    </div>
  );
}
