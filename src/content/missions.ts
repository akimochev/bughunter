import type { LearnerMission, ReadyMission } from "@/types/mission";

export const missions: ReadyMission[] = [
  {
    id: 1,
    slug: "missing-purchase",
    title: "Пропавшая покупка",
    tier: "beginner",
    description:
      "В чеке есть все покупки, а итоговая сумма не сходится. Куда исчезла часть суммы?",
    topic: "Циклы и range",
    functionName: "sum_prices",
    contentStatus: "ready",
    content: {
      story:
        "В школьной лавке сверяют покупки после ярмарки. Все цены записаны, но кассовая программа показывает сумму меньше настоящей. Восстанови расчёт, чтобы организаторы получили правильный итог.",
      goal: "Исправь sum_prices(prices), чтобы функция возвращала сумму всех цен.",
      expectedBehavior:
        "Каждая цена учитывается ровно один раз. Для пустого списка результат равен 0. Исходный список менять нельзя.",
      constraints: [
        "prices — список целых чисел от 0 до 10 000.",
        "Длина списка — от 0 до 100.",
      ],
      starterCode:
        "def sum_prices(prices):\n    total = 0\n    for i in range(len(prices) - 1):\n        total += prices[i]\n    return total",
      buggyLine: 3,
      referenceSolution:
        "def sum_prices(prices):\n    total = 0\n    for i in range(len(prices)):\n        total += prices[i]\n    return total",
      publicTests: [
        {
          id: "purchase-public-1",
          args: [[100, 50, 25]],
          expected: 175,
          isPublic: true,
        },
        { id: "purchase-public-2", args: [[40]], expected: 40, isPublic: true },
        { id: "purchase-public-3", args: [[]], expected: 0, isPublic: true },
      ],
      hiddenTests: [
        {
          id: "purchase-extra-1",
          args: [[0, 0]],
          expected: 0,
          isPublic: false,
        },
        {
          id: "purchase-extra-2",
          args: [[5, 5, 5, 5]],
          expected: 20,
          isPublic: false,
        },
        {
          id: "purchase-extra-3",
          args: [[0, 10000]],
          expected: 10000,
          isPublic: false,
        },
      ],
      hints: [
        "Проследи, какие покупки попадают в total на каждой итерации.",
        "Проверь список из одной покупки. Сколько раз выполнится цикл?",
        "Правая граница range не включается. Сравни её с количеством элементов.",
      ],
      theory:
        "range(stop) создаёт последовательность от 0 до stop − 1. Индексы списка длины n лежат от 0 до n − 1. Накопитель хранит результат предыдущих итераций.",
      explanation:
        "Вычитание единицы из длины уменьшало число итераций. Последняя цена оставалась за пределами цикла. range(len(prices)) перебирает все допустимые индексы.",
    },
  },
  {
    id: 2,
    slug: "parity-password",
    title: "Пароль чётности",
    tier: "beginner",
    description:
      "Система пропускает не те числа. Разберись, что случилось с проверкой чётности.",
    topic: "Условия и остаток от деления",
    functionName: "is_even",
    contentStatus: "ready",
    content: {
      story:
        "Замок учебной лаборатории должен пропускать только чётные числовые пароли. После обновления он принимает нечётные и отвергает чётные. Исследуй условие допуска.",
      goal: "Исправь is_even(n), чтобы функция определяла чётность целого числа.",
      expectedBehavior:
        "Верни bool — True для чётного числа и False для нечётного. Ноль считается чётным. Отрицательные числа тоже поддерживаются.",
      constraints: [
        "n — целое число от −10 000 до 10 000.",
        "Результат должен иметь тип bool.",
      ],
      starterCode: "def is_even(n):\n    return n % 2 == 1",
      buggyLine: 2,
      referenceSolution: "def is_even(n):\n    return n % 2 == 0",
      publicTests: [
        { id: "parity-public-1", args: [8], expected: true, isPublic: true },
        { id: "parity-public-2", args: [7], expected: false, isPublic: true },
        { id: "parity-public-3", args: [0], expected: true, isPublic: true },
      ],
      hiddenTests: [
        { id: "parity-extra-1", args: [-4], expected: true, isPublic: false },
        { id: "parity-extra-2", args: [-3], expected: false, isPublic: false },
        {
          id: "parity-extra-3",
          args: [10000],
          expected: true,
          isPublic: false,
        },
      ],
      hints: [
        "Проверь вручную один чётный и один нечётный пароль.",
        "Оператор % возвращает остаток от деления. Какой остаток у 8 при делении на 2?",
        "Чётное число делится на 2 без остатка. Сравнение должно выражать именно это.",
      ],
      theory:
        "Оператор % вычисляет остаток от деления. Выражение сравнения возвращает True или False. Целое число чётное, если делится на 2 без остатка.",
      explanation:
        "Условие n % 2 == 1 распознавало нечётные числа. Для чётности остаток должен равняться нулю, включая n = 0 и отрицательные чётные числа.",
    },
  },
  {
    id: 3,
    slug: "early-answer",
    title: "Преждевременный ответ",
    tier: "beginner",
    description:
      "Поиск заканчивается раньше времени. Выясни, почему функция торопится с ответом.",
    topic: "Циклы и return",
    functionName: "count_occurrences",
    contentStatus: "ready",
    content: {
      story:
        "В архиве ищут повторяющиеся номера улик. Счётчик сообщает ответ, едва начав просмотр списка. Установи, почему часть записей остаётся без внимания.",
      goal: "Исправь count_occurrences(nums, target), чтобы посчитать все вхождения target в nums.",
      expectedBehavior:
        "Верни целое число совпадений. Если совпадений нет или список пуст, верни 0. Исходный список менять нельзя.",
      constraints: [
        "nums — список от 0 до 100 целых чисел.",
        "Элементы и target — целые числа от −1000 до 1000.",
      ],
      starterCode:
        "def count_occurrences(nums, target):\n    count = 0\n    for num in nums:\n        if num == target:\n            count += 1\n        return count",
      buggyLine: 6,
      referenceSolution:
        "def count_occurrences(nums, target):\n    count = 0\n    for num in nums:\n        if num == target:\n            count += 1\n    return count",
      publicTests: [
        {
          id: "count-public-1",
          args: [[2, 1, 2, 2], 2],
          expected: 3,
          isPublic: true,
        },
        {
          id: "count-public-2",
          args: [[1, 3], 2],
          expected: 0,
          isPublic: true,
        },
        { id: "count-public-3", args: [[], 5], expected: 0, isPublic: true },
      ],
      hiddenTests: [
        { id: "count-extra-1", args: [[7], 7], expected: 1, isPublic: false },
        {
          id: "count-extra-2",
          args: [[0, 0, 0], 0],
          expected: 3,
          isPublic: false,
        },
        {
          id: "count-extra-3",
          args: [[-1, 3, -1], -1],
          expected: 2,
          isPublic: false,
        },
      ],
      hints: [
        "Проследи, успевает ли функция просмотреть вторую запись.",
        "return немедленно завершает всю функцию, даже когда находится внутри цикла.",
        "Посмотри на отступ строки возврата. Ответ нужен после просмотра всего списка.",
      ],
      theory:
        "В Python отступы определяют вложенность блоков. return завершает функцию целиком. Если выполнение дошло до конца функции без return, Python возвращает None.",
      explanation:
        "return находился внутри for и завершал функцию после первого элемента. На пустом списке он вообще не выполнялся. Перенос возврата за цикл исправляет оба случая.",
    },
  },
  {
    id: 4,
    slug: "lost-record",
    title: "Потерянный рекорд",
    tier: "intermediate",
    description:
      "Программа нашла рекорд, которого нет в списке. Проверь её на необычных данных.",
    topic: "Граничные случаи",
    functionName: "find_max",
    contentStatus: "ready",
    content: {
      story:
        "Метеостанция выбирает самую высокую температуру за ночь. В морозную ночь она объявила рекорд 0, хотя такого измерения не было. Найди неверное предположение в алгоритме.",
      goal: "Исправь find_max(nums), чтобы найти наибольшее число непустого списка.",
      expectedBehavior:
        "Верни максимальный элемент, в том числе когда все числа отрицательные. Исходный список менять нельзя.",
      constraints: [
        "nums — непустой список от 1 до 100 целых чисел.",
        "Каждое число — от −10 000 до 10 000.",
      ],
      starterCode:
        "def find_max(nums):\n    maximum = 0\n    for num in nums:\n        if num > maximum:\n            maximum = num\n    return maximum",
      buggyLine: 2,
      referenceSolution:
        "def find_max(nums):\n    maximum = nums[0]\n    for num in nums:\n        if num > maximum:\n            maximum = num\n    return maximum",
      publicTests: [
        { id: "max-public-1", args: [[3, 9, 2]], expected: 9, isPublic: true },
        {
          id: "max-public-2",
          args: [[-8, -3, -12]],
          expected: -3,
          isPublic: true,
        },
        { id: "max-public-3", args: [[-5]], expected: -5, isPublic: true },
      ],
      hiddenTests: [
        { id: "max-extra-1", args: [[0]], expected: 0, isPublic: false },
        {
          id: "max-extra-2",
          args: [[-7, 0, -2]],
          expected: 0,
          isPublic: false,
        },
        { id: "max-extra-3", args: [[-4, -4]], expected: -4, isPublic: false },
        {
          id: "max-extra-4",
          args: [[10000, -10000]],
          expected: 10000,
          isPublic: false,
        },
      ],
      hints: [
        "Проверь случай, когда все температуры ниже нуля.",
        "Какое значение maximum имеет до первого сравнения? Может ли оно отсутствовать в данных?",
        "Список гарантированно непустой. Начальный кандидат может быть одним из его элементов.",
      ],
      theory:
        "Начальное значение накопителя должно подходить для всех разрешённых входов. При поиске максимума в непустом списке первый элемент уже является допустимым кандидатом.",
      explanation:
        "Начальный максимум 0 превышал все отрицательные элементы и никогда не менялся. Начало с nums[0] гарантирует, что результат принадлежит входному списку.",
    },
  },
  {
    id: 5,
    slug: "endless-countdown",
    title: "Бесконечный обратный отсчёт",
    tier: "intermediate",
    description:
      "Таймер запущен, но до нуля всё дальше. Найди причину бесконечного отсчёта.",
    topic: "Цикл while",
    functionName: "countdown",
    contentStatus: "ready",
    content: {
      story:
        "Команда робототехники готовит запуск. Табло должно отсчитать секунды до старта, но счётчик удаляется от нуля. Разберись, почему условие цикла остаётся истинным.",
      goal: "Исправь countdown(n), чтобы вернуть список чисел от n до 1 в убывающем порядке.",
      expectedBehavior:
        "Для n = 3 верни [3, 2, 1]. Ноль в список не входит. Для n = 0 верни пустой список. Функция должна завершаться.",
      constraints: [
        "n — целое число от 0 до 100.",
        "Верни список целых чисел.",
      ],
      starterCode:
        "def countdown(n):\n    result = []\n    while n > 0:\n        result.append(n)\n        n += 1\n    return result",
      buggyLine: 5,
      referenceSolution:
        "def countdown(n):\n    result = []\n    while n > 0:\n        result.append(n)\n        n -= 1\n    return result",
      publicTests: [
        {
          id: "timer-public-1",
          args: [3],
          expected: [3, 2, 1],
          isPublic: true,
        },
        { id: "timer-public-2", args: [1], expected: [1], isPublic: true },
        { id: "timer-public-3", args: [0], expected: [], isPublic: true },
      ],
      hiddenTests: [
        { id: "timer-extra-1", args: [2], expected: [2, 1], isPublic: false },
        {
          id: "timer-extra-2",
          args: [5],
          expected: [5, 4, 3, 2, 1],
          isPublic: false,
        },
        {
          id: "timer-extra-3",
          args: [10],
          expected: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
          isPublic: false,
        },
      ],
      hints: [
        "Запиши первые три значения счётчика на бумаге.",
        "Чтобы while завершился, n > 0 когда-нибудь должно стать ложным.",
        "Проверь направление изменения n. Каждый шаг должен приближать счётчик к нулю.",
      ],
      theory:
        "while повторяет блок, пока условие истинно. Нужно изменять состояние так, чтобы условие завершения стало достижимым. append добавляет элемент в конец списка.",
      explanation:
        "n += 1 увеличивал положительное число, поэтому n > 0 оставалось истинным. Уменьшение счётчика на каждом шаге приводит его к нулю и завершает цикл.",
    },
  },
  {
    id: 6,
    slug: "broken-filter",
    title: "Сломанный фильтр",
    tier: "intermediate",
    description:
      "В отобранные данные попало лишнее. Восстанови фильтр положительных чисел.",
    topic: "Списки и фильтрация",
    functionName: "filter_positive",
    contentStatus: "ready",
    content: {
      story:
        "Лабораторный датчик отбирает положительные показания. В отчёт попали и нулевые значения. Проверь, как фильтр решает, что оставить.",
      goal: "Исправь filter_positive(nums), чтобы вернуть только строго положительные элементы.",
      expectedBehavior:
        "Сохраняй порядок и повторы. Ноль и отрицательные числа исключаются. Верни новый список, сохранив исходный.",
      constraints: [
        "nums — список от 0 до 100 целых чисел.",
        "Каждое число — от −1000 до 1000.",
      ],
      starterCode:
        "def filter_positive(nums):\n    result = []\n    for num in nums:\n        if num >= 0:\n            result.append(num)\n    return result",
      buggyLine: 4,
      referenceSolution:
        "def filter_positive(nums):\n    result = []\n    for num in nums:\n        if num > 0:\n            result.append(num)\n    return result",
      publicTests: [
        {
          id: "filter-public-1",
          args: [[-2, 0, 3, 1]],
          expected: [3, 1],
          isPublic: true,
        },
        { id: "filter-public-2", args: [[]], expected: [], isPublic: true },
        { id: "filter-public-3", args: [[0]], expected: [], isPublic: true },
      ],
      hiddenTests: [
        {
          id: "filter-extra-1",
          args: [[-3, -1]],
          expected: [],
          isPublic: false,
        },
        {
          id: "filter-extra-2",
          args: [[4, 2, 4]],
          expected: [4, 2, 4],
          isPublic: false,
        },
        {
          id: "filter-extra-3",
          args: [[0, 5, 0, -1, 2]],
          expected: [5, 2],
          isPublic: false,
        },
      ],
      hints: [
        "Сравни понятия «положительный» и «неотрицательный».",
        "Проверь один элемент, равный нулю. Должен ли он пройти фильтр?",
        "Посмотри, разрешает ли оператор сравнения равенство нулю.",
      ],
      theory:
        "Строго положительные числа больше нуля. Неотрицательные числа включают ноль. Последовательный обход с append сохраняет порядок и повторы элементов.",
      explanation:
        "Оператор >= пропускал ноль. По условию нужны только числа строго больше нуля, поэтому сравнение заменено на >.",
    },
  },
  {
    id: 7,
    slug: "binary-glitch",
    title: "Бинарный сбой",
    tier: "advanced",
    description:
      "Быстрый поиск теряет след. Исследуй, как меняются границы области поиска.",
    topic: "Бинарный поиск",
    functionName: "binary_search",
    contentStatus: "ready",
    content: {
      story:
        "Архив отсортирован по номерам дел. Бинарный поиск работает быстро, пока запрашиваемого номера нет в конце архива. Тогда он пытается прочитать несуществующую ячейку.",
      goal: "Исправь binary_search(sorted_nums, target), чтобы найти индекс target или вернуть −1.",
      expectedBehavior:
        "Ищи за O(log n). Верни индекс target, если он есть, и −1 в противном случае. Пустой список допустим. Исходный список менять нельзя.",
      constraints: [
        "sorted_nums — список от 0 до 100 целых чисел по возрастанию, без повторов.",
        "Элементы и target — целые числа от −10 000 до 10 000.",
      ],
      starterCode:
        "def binary_search(sorted_nums, target):\n    left = 0\n    right = len(sorted_nums)\n    while left <= right:\n        mid = (left + right) // 2\n        if sorted_nums[mid] == target:\n            return mid\n        if sorted_nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
      buggyLine: 3,
      referenceSolution:
        "def binary_search(sorted_nums, target):\n    left = 0\n    right = len(sorted_nums) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if sorted_nums[mid] == target:\n            return mid\n        if sorted_nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
      publicTests: [
        {
          id: "binary-public-1",
          args: [[1, 3, 5, 7], 5],
          expected: 2,
          isPublic: true,
        },
        {
          id: "binary-public-2",
          args: [[1, 3, 5], 8],
          expected: -1,
          isPublic: true,
        },
        { id: "binary-public-3", args: [[], 4], expected: -1, isPublic: true },
      ],
      hiddenTests: [
        { id: "binary-extra-1", args: [[2], 2], expected: 0, isPublic: false },
        { id: "binary-extra-2", args: [[2], 1], expected: -1, isPublic: false },
        {
          id: "binary-extra-3",
          args: [[-9, -2, 0, 6], -9],
          expected: 0,
          isPublic: false,
        },
        {
          id: "binary-extra-4",
          args: [[1, 3, 5, 7], 7],
          expected: 3,
          isPublic: false,
        },
        {
          id: "binary-extra-5",
          args: [[1, 3, 5], 2],
          expected: -1,
          isPublic: false,
        },
      ],
      hints: [
        "Начни с пустого архива и с запроса, который больше всех его номеров.",
        "В этом алгоритме обе границы включены. Какие индексы у списка длины n?",
        "Сравни начальное значение right с последним допустимым индексом.",
      ],
      theory:
        "Бинарный поиск сокращает отсортированный диапазон примерно вдвое. Здесь используется закрытый интервал [left, right]. Когда left > right, диапазон пуст. Последний индекс списка длины n равен n − 1.",
      explanation:
        "Правая граница равнялась длине списка, хотя интервал включал её. При поиске отсутствующего большого числа или на пустом списке mid мог выйти за пределы. Начальная граница len(sorted_nums) − 1 исправляет это.",
    },
  },
  {
    id: 8,
    slug: "two-pointers",
    title: "Два указателя",
    tier: "advanced",
    description:
      "Нужная пара совсем рядом, но указатели расходятся. Верни поиск на верный путь.",
    topic: "Два указателя",
    functionName: "has_pair",
    contentStatus: "ready",
    content: {
      story:
        "Два сканера ищут в отсортированном архиве пару кодов с заданной суммой. Когда сумма слишком мала, один сканер уходит за край. Восстанови направление поиска.",
      goal: "Исправь has_pair(sorted_nums, target), чтобы определить, есть ли два разных элемента с суммой target.",
      expectedBehavior:
        "Верни bool. Используй разные индексы, сохраняя порядок исходных данных. Для списка короче двух элементов верни False. Ожидается O(n).",
      constraints: [
        "sorted_nums — список от 0 до 100 целых чисел по неубыванию. Повторы допустимы.",
        "Элементы — от −1000 до 1000, target — от −2000 до 2000.",
      ],
      starterCode:
        "def has_pair(sorted_nums, target):\n    left = 0\n    right = len(sorted_nums) - 1\n    while left < right:\n        total = sorted_nums[left] + sorted_nums[right]\n        if total == target:\n            return True\n        if total < target:\n            left -= 1\n        else:\n            right -= 1\n    return False",
      buggyLine: 9,
      referenceSolution:
        "def has_pair(sorted_nums, target):\n    left = 0\n    right = len(sorted_nums) - 1\n    while left < right:\n        total = sorted_nums[left] + sorted_nums[right]\n        if total == target:\n            return True\n        if total < target:\n            left += 1\n        else:\n            right -= 1\n    return False",
      publicTests: [
        {
          id: "pair-public-1",
          args: [[1, 2, 4, 7], 9],
          expected: true,
          isPublic: true,
        },
        {
          id: "pair-public-2",
          args: [[1, 2, 3], 10],
          expected: false,
          isPublic: true,
        },
        { id: "pair-public-3", args: [[], 0], expected: false, isPublic: true },
      ],
      hiddenTests: [
        {
          id: "pair-extra-1",
          args: [[4], 8],
          expected: false,
          isPublic: false,
        },
        {
          id: "pair-extra-2",
          args: [[3, 3], 6],
          expected: true,
          isPublic: false,
        },
        {
          id: "pair-extra-3",
          args: [[-5, -2, 0, 4], -7],
          expected: true,
          isPublic: false,
        },
        {
          id: "pair-extra-4",
          args: [[1, 2, 5], 4],
          expected: false,
          isPublic: false,
        },
      ],
      hints: [
        "Проследи индексы, когда текущая сумма меньше цели. Остаются ли они внутри списка?",
        "В отсортированном списке сдвиг к большему элементу увеличивает сумму.",
        "Когда сумма мала, левый указатель должен двигаться к правому, чтобы взять большее число.",
      ],
      theory:
        "Два указателя начинают на концах отсортированного списка. При малой сумме увеличивают меньший элемент, при большой уменьшают больший. Условие left < right не позволяет использовать один элемент дважды.",
      explanation:
        "left -= 1 двигал левый индекс назад. В Python отрицательные индексы читают элементы с конца, поэтому могли возникнуть ложные совпадения и выход за пределы. Сдвиг left += 1 увеличивает меньший элемент и сужает диапазон.",
    },
  },
];

export function getMission(slug: string): ReadyMission | undefined {
  return missions.find((mission) => mission.slug === slug);
}

export const missionSummaries = missions.map(
  ({ id, slug, title, tier, description, topic, functionName }) => ({
    id,
    slug,
    title,
    tier,
    description,
    topic,
    functionName,
  }),
);

export function toLearnerMission(mission: ReadyMission): LearnerMission {
  const { content } = mission;
  return {
    id: mission.id,
    slug: mission.slug,
    title: mission.title,
    tier: mission.tier,
    description: mission.description,
    topic: mission.topic,
    functionName: mission.functionName,
    verification: {
      buggyLine: content.buggyLine,
      hiddenTests: content.hiddenTests,
      explanation: content.explanation,
    },
    content: {
      story: content.story,
      goal: content.goal,
      expectedBehavior: content.expectedBehavior,
      constraints: content.constraints,
      starterCode: content.starterCode,
      publicTests: content.publicTests,
      hints: content.hints,
      theory: content.theory,
    },
  };
}
