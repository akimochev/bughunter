import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  FolderCheck,
  Fingerprint,
  Star,
  Zap,
} from "lucide-react";
import { PageHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Профиль",
  description:
    "Будущий профиль детектива BugHunter. Пройденные дела, звёзды и достижения.",
};

export default function ProfilePage() {
  return (
    <div className="container page-content">
      <PageHeading eyebrow="ЛИЧНОЕ ДЕЛО" title="Профиль детектива">
        Здесь будет история твоих расследований и маленьких побед над багами.
      </PageHeading>
      <section className="profile-panel panel">
        <div className="profile-identity">
          <span className="avatar">
            <Fingerprint size={39} strokeWidth={1.4} />
          </span>
          <div>
            <span className="eyebrow">ГОСТЕВОЙ ПРОФИЛЬ</span>
            <h2>Детектив</h2>
            <p className="muted">
              Каждое расследование начинается с любопытства.
            </p>
          </div>
        </div>
        <div className="stats-grid">
          <div>
            <FolderCheck size={21} />
            <strong>
              0 <span>/ 8</span>
            </strong>
            <span>Дел закрыто</span>
          </div>
          <div>
            <Zap size={21} />
            <strong>0</strong>
            <span>Очков опыта</span>
          </div>
          <div>
            <Star size={21} />
            <strong>
              0 <span>/ 24</span>
            </strong>
            <span>Звёзд собрано</span>
          </div>
        </div>
        <p className="profile-disclaimer">
          Это начальное состояние профиля. Учёт и сохранение прогресса появятся
          на этапе 4.
        </p>
      </section>
      <section className="panel profile-empty">
        <span className="empty-icon">
          <Award size={30} strokeWidth={1.5} />
        </span>
        <h2>Всё самое интересное впереди</h2>
        <p>
          Пройденных миссий и достижений пока нет.
          <br />А пока можно познакомиться с будущими делами.
        </p>
        <Link href="/missions" className="button button-primary">
          Посмотреть миссии <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
