"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Award,
  Fingerprint,
  FolderCheck,
  LockKeyhole,
  Star,
  Zap,
} from "lucide-react";
import { useProgress } from "./progress-provider";
import { StarRating } from "./star-rating";
import { achievements, isMissionUnlocked } from "@/lib/progress/rules";
import { tiers } from "@/content/mission-tiers";
import type { MissionTier } from "@/types/mission";

export function ProfileProgress() {
  const { ready, progress, missions, store } = useProgress();
  const [confirmClear, setConfirmClear] = useState(false);
  if (!ready)
    return (
      <div className="panel access-panel" role="status">
        Загружаем профиль…
      </div>
    );
  const completed = missions.filter(
    (mission) => progress.missions[mission.id]?.best,
  );
  const statistics = Object.values(progress.missions).reduce(
    (total, mission) => ({
      submissions: total.submissions + mission.statistics.submissions,
      counted: total.counted + mission.statistics.counted,
      cancelled: total.cancelled + mission.statistics.cancelled,
    }),
    { submissions: 0, counted: 0, cancelled: 0 },
  );
  return (
    <>
      <section className="profile-panel panel">
        <div className="profile-identity">
          <span className="avatar">
            <Fingerprint size={39} strokeWidth={1.4} />
          </span>
          <div>
            <span className="eyebrow">ГОСТЕВОЙ ПРОФИЛЬ</span>
            <h2>Детектив</h2>
            <p className="muted">Прогресс на этом устройстве</p>
          </div>
        </div>
        <div className="stats-grid">
          <div>
            <FolderCheck size={21} />
            <strong data-testid="completed-count">
              {progress.completedCount} <span>/ {missions.length}</span>
            </strong>
            <span>Дел закрыто</span>
          </div>
          <div>
            <Zap size={21} />
            <strong data-testid="total-xp">{progress.totalXp}</strong>
            <span>Очков опыта</span>
          </div>
          <div>
            <Star size={21} />
            <strong data-testid="total-stars">
              {progress.totalStars} <span>/ {missions.length * 3}</span>
            </strong>
            <span>Лучших звёзд</span>
          </div>
        </div>
        <div className="learning-progress">
          <label htmlFor="learning-progress">
            Общий прогресс — {progress.completedCount} из {missions.length}{" "}
            миссий
          </label>
          <progress
            id="learning-progress"
            value={progress.completedCount}
            max={missions.length}
          />
        </div>
        <p className="profile-disclaimer">
          Завершённых проверок отправки — {statistics.submissions}. Для награды
          учтено — {statistics.counted}. Отменено — {statistics.cancelled}.
        </p>
      </section>
      <section className="panel profile-section">
        <h2>Прогресс по уровням</h2>
        <div className="tier-progress-grid">
          {(["beginner", "intermediate", "advanced"] as MissionTier[]).map(
            (tier) => {
              const group = missions.filter((mission) => mission.tier === tier);
              const done = group.filter(
                (mission) => progress.missions[mission.id]?.best,
              ).length;
              const unlocked =
                group.length > 0 &&
                isMissionUnlocked(group[0], progress, missions);
              return (
                <div key={tier}>
                  <h3>{tiers[tier].label}</h3>
                  <p>
                    {unlocked ? "Уровень открыт" : "Уровень заблокирован"} ·{" "}
                    {done} / {group.length}
                  </p>
                  <progress
                    value={done}
                    max={group.length}
                    aria-label={`Прогресс уровня «${tiers[tier].label}»`}
                  />
                </div>
              );
            },
          )}
        </div>
      </section>
      <section className="panel profile-section">
        <h2>
          Достижения{" "}
          <span className="muted">
            {Object.keys(progress.achievements).length} / {achievements.length}
          </span>
        </h2>
        <div className="achievements-grid">
          {achievements.map((achievement) => {
            const unlocked = Boolean(progress.achievements[achievement.id]);
            const Icon = unlocked ? Award : LockKeyhole;
            return (
              <article
                key={achievement.id}
                className={`achievement${unlocked ? " achievement-unlocked" : ""}`}
                data-achievement={achievement.id}
                data-unlocked={unlocked}
              >
                <Icon size={24} />
                <div>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                  <span>{unlocked ? "Открыто" : "Пока закрыто"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel profile-section">
        <h2>Пройденные миссии</h2>
        {completed.length === 0 ? (
          <div className="profile-empty">
            <p>Начни с уровня «Новичок» и закрой своё первое дело.</p>
            <Link href="/missions" className="button button-primary">
              К миссиям
            </Link>
          </div>
        ) : (
          <div className="completed-missions">
            {completed.map((mission) => {
              const entry = progress.missions[mission.id];
              const best = entry.best!;
              return (
                <Link href={`/missions/${mission.slug}`} key={mission.id}>
                  <div>
                    <h3>{mission.title}</h3>
                    <p>
                      Лучшее прохождение · подсказок {best.hintsUsed}, учтено
                      отправок {best.attempts}
                    </p>
                  </div>
                  <div>
                    <StarRating stars={best.stars} />
                    <strong>{best.xp} XP</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <div className="profile-clear">
        <button
          className="button button-secondary"
          onClick={() => setConfirmClear(true)}
        >
          Очистить прогресс
        </button>
        {confirmClear && (
          <div
            className="panel reset-confirmation"
            role="group"
            aria-label="Подтверждение очистки прогресса"
          >
            <p>
              Удалить результаты и достижения на этом устройстве? Черновики кода
              сохранятся.
            </p>
            <button
              className="button button-secondary"
              onClick={() => {
                if (store.clear()) setConfirmClear(false);
              }}
            >
              Удалить прогресс
            </button>
            <button
              className="button button-secondary"
              onClick={() => setConfirmClear(false)}
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </>
  );
}
