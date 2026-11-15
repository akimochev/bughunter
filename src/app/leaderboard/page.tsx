import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "Рейтинг скоро",
  description: "Рейтинг детективов появится в будущей версии BugHunter.",
};

export default function LeaderboardPage() {
  return (
    <div className="container coming-soon">
      <div className="trophy-scene" aria-hidden="true">
        <span className="trophy-ring ring-outer" />
        <span className="trophy-ring ring-inner" />
        <span className="trophy-icon">
          <Trophy size={53} strokeWidth={1.3} />
        </span>
      </div>
      <p className="eyebrow">СЛЕДУЮЩАЯ ГЛАВА</p>
      <h1>Рейтинг скоро</h1>
      <p>
        Здесь появится дружеский рейтинг охотников за багами.
        <br />
        Сейчас можно изучить миссии и выбрать своё первое дело.
      </p>
      <Link href="/missions" className="button button-primary">
        К карте дел <ArrowRight size={18} />
      </Link>
      <span className="coming-note">Рейтинг появится в будущей версии.</span>
    </div>
  );
}
