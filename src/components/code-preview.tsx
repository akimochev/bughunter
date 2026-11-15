import { FileCode2, ScanLine, Terminal } from "lucide-react";

export function CodePreview() {
  return (
    <div className="code-scene">
      <div className="scene-orbit" aria-hidden="true" />
      <div className="code-window">
        <div className="code-titlebar">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>
            <FileCode2 size={14} /> case_01.py
          </span>
          <span className="python-label">Python</span>
        </div>
        <div className="code-context">
          <span className="small-dot" />
          Дело 01<span className="context-divider">/</span>Пропавшая покупка
        </div>
        <div
          className="code-lines"
          aria-label="Пример исходного кода первого дела"
        >
          <div>
            <span className="line-number">1</span>
            <code>
              <span className="syntax-purple">def</span>{" "}
              <span className="syntax-blue">sum_prices</span>(prices):
            </code>
          </div>
          <div>
            <span className="line-number">2</span>
            <code>
              {"    "}total = <span className="syntax-orange">0</span>
            </code>
          </div>
          <div>
            <span className="line-number">3</span>
            <code>
              {"    "}
              <span className="syntax-purple">for</span> i{" "}
              <span className="syntax-purple">in</span>{" "}
              <span className="syntax-blue">range</span>(
              <span className="syntax-blue">len</span>(prices) -{" "}
              <span className="syntax-orange">1</span>):
            </code>
          </div>
          <div>
            <span className="line-number">4</span>
            <code>{"        "}total += prices[i]</code>
          </div>
          <div>
            <span className="line-number">5</span>
            <code>
              {"    "}
              <span className="syntax-purple">return</span> total
            </code>
          </div>
          <div className="code-comment">
            <span className="line-number">6</span>
            <code> </code>
          </div>
          <div className="code-comment">
            <span className="line-number">7</span>
            <code># Кажется, что-то потерялось…</code>
          </div>
        </div>
        <div className="scene-terminal">
          <Terminal size={15} />
          <span>Фрагмент дела · без запуска</span>
          <span className="terminal-cursor" aria-hidden="true" />
        </div>
      </div>
      <div className="clue-card">
        <span className="clue-icon">
          <ScanLine size={23} />
        </span>
        <div>
          <strong>В коде спряталась ошибка</strong>
          <span>Сможешь найти её след?</span>
        </div>
      </div>
    </div>
  );
}
