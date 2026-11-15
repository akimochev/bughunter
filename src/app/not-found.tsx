import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container coming-soon">
      <span className="empty-icon">
        <SearchX size={37} />
      </span>
      <p className="eyebrow">ОШИБКА 404</p>
      <h1>След потерялся</h1>
      <p>
        Такой страницы нет в материалах дела.
        <br />
        Попробуй начать с карты миссий.
      </p>
      <Link href="/missions" className="button button-primary">
        <ArrowLeft size={17} />
        Вернуться к делам
      </Link>
    </div>
  );
}
