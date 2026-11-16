import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Crosshair,
  Search,
  Sparkles,
} from "lucide-react";
import { CodePreview } from "@/components/code-preview";
import { ProgressMissionCard } from "@/components/missions/progress-mission-card";
import { missionSummaries as missions } from "@/content/missions";

const steps = [
  {
    icon: Search,
    title: "Найди ошибку",
    text: "Изучи историю дела и вычисли строку, в которой всё пошло не так.",
  },
  {
    icon: Code2,
    title: "Исправь код",
    text: "Проверь свою гипотезу и внеси исправление в Python-функцию.",
  },
  {
    icon: Sparkles,
    title: "Разберись в причине",
    text: "Запусти тесты и узнай, почему возник баг и как его избежать.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" />
            ТРЕНАЖЁР ПО ОТЛАДКЕ PYTHON
          </p>
          <h1>
            У каждой ошибки
            <br />
            есть <span>след.</span>
          </h1>
          <p className="hero-lead">Код сломан. Дело за тобой.</p>
          <p className="hero-description">
            Находи баги, распутывай логику и прокачивай Python в детективных
            миссиях для 8–11 классов.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/missions">
              Начать расследование <ArrowRight size={18} />
            </Link>
            <a className="text-link" href="#how-it-works">
              Как это работает <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div className="hero-benefits">
            <span>
              <Check size={14} />
              Без регистрации
            </span>
            <span>
              <Check size={14} />
              Бесплатно
            </span>
            <span>
              <Check size={14} />В своём темпе
            </span>
          </div>
        </div>
        <CodePreview />
      </section>
      <div className="container">
        <div className="stage-notice">
          <span className="notice-icon">
            <Code2 size={17} />
          </span>
          <p>
            <strong>Проверка решений доступна.</strong> Запускай публичные тесты
            и отправляй исправление на полную проверку.
          </p>
        </div>
      </div>
      <section id="how-it-works" className="container how-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">МЕТОД РАССЛЕДОВАНИЯ</p>
            <h2>Меньше зубрёжки. Больше практики.</h2>
          </div>
          <p className="section-aside">
            Ошибки — часть обучения.
            <br />
            Научись их замечать.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article className="step" key={title}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon size={23} strokeWidth={1.7} />
                </span>
                <span className="step-number">0{index + 1}</span>
                {index < 2 && <ArrowRight className="step-arrow" size={18} />}
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="missions-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ПЕРВЫЕ ЗАЦЕПКИ</p>
              <h2>Твоё первое дело уже здесь</h2>
            </div>
            <Link className="text-link" href="/missions">
              Все {missions.length} миссий <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="missions-grid">
            {missions.slice(0, 3).map((mission) => (
              <ProgressMissionCard key={mission.id} mission={mission} />
            ))}
          </div>
          <div className="bottom-note">
            <Crosshair size={17} />
            <span>
              От простых циклов до бинарного поиска. Одно дело — одна новая
              зацепка.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
