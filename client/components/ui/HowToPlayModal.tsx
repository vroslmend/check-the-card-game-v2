"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { y: "100vh", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
  exit: { y: "100vh", opacity: 0, transition: { duration: 0.3 } },
};

export const HowToPlayModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-2xl p-8 bg-stone-50/90 dark:bg-stone-950/90 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 rounded-full"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
            
            <h2 className="text-3xl font-bold text-center mb-6 flex items-center justify-center gap-3">
              <HelpCircle className="w-8 h-8"/>
              How to Play CHECK!
            </h2>

            <div className="space-y-4 text-stone-700 dark:text-stone-300 max-h-[70vh] overflow-y-auto pr-4">
              <section>
                <h3 className="font-semibold text-lg mb-2">The Goal</h3>
                <p>The goal is to have the lowest score at the end of the round. A round ends when a player calls "Check!".</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">Setup</h3>
                <p>Each player is dealt 4 cards, face down. You get to secretly peek at your two outermost cards at the beginning.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">On Your Turn</h3>
                <p>You have two choices:</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li><strong>Draw from the Deck:</strong> Take the top card from the deck. You can either swap it for one of your hand cards (discarding your hand card face up) or discard the drawn card face up.</li>
                  <li><strong>Draw from the Discard Pile:</strong> Take the top card from the discard pile. You MUST swap it for one of your hand cards.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">Calling "Check!"</h3>
                <p>If you believe you have the lowest score, you can call "Check!" at the start of your turn instead of drawing. This locks your hand. Every other player then gets one final turn.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">Matching</h3>
                <p>If a player discards a card, and another player has a card of the same rank, they can discard their matching card out of turn (a "match"). A successful match reduces the number of cards in their hand. A failed match results in a penalty card from the deck.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">Special Cards</h3>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li><strong>King:</strong> Look at one of your own cards, or one of an opponent's cards.</li>
                  <li><strong>Queen:</strong> Swap any two cards on the table, including your own and opponents'.</li>
                  <li><strong>Jack:</strong> The "blind swap". Swap one of your cards with an opponent's without looking at either.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg mb-2">Scoring</h3>
                <p>Aces are worth -1 point. Numbered cards are worth their face value. Jack, Queen, and King are 11, 12, and 13 points respectively.</p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 