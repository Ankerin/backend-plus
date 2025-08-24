// utils/loaders.ts
import ora from 'ora';
import chalk from 'chalk';

const loaders = [
  'dots',
  'dots2',
  'dots3',
  'dots4',
  'dots5',
  'dots6',
  'dots7',
  'dots8',
  'dots9',
  'dots10',
  'dots11',
  'line',
  'line2',
  'pipe',
  'simpleDots',
  'simpleDotsScrolling',
  'star',
  'flip',
  'hamburger',
  'growVertical',
  'growHorizontal',
  'balloon',
  'balloon2',
  'clock',
  'earth',
  'moon',
  'runner',
  'pong',
  'shark',
  'dqpb',
];

const runLoadersDemo = async () => {
  console.log(chalk.cyanBright('🟢 Запуск демо всех спиннеров ora:\n'));
  
  for (const spinnerName of loaders) {
    const spinner = ora({
      text: chalk.yellow(`Пример спиннера: ${spinnerName}`),
      spinner: spinnerName as any, // Ora поддерживает строки-имена спиннеров
    }).start();

    // Немного ждем, чтобы увидеть анимацию
    await new Promise((resolve) => setTimeout(resolve, 1200));

    spinner.succeed(chalk.green(`Завершено: ${spinnerName}\n`));
  }

  console.log(chalk.cyanBright('✅ Все спиннеры ora показаны.'));
};

export default runLoadersDemo;
