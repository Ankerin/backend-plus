import ora, { Ora } from 'ora';
import chalk from 'chalk';

class Loader {
  private spinner: Ora | null = null;

  start(message: string) {
    this.spinner = ora({
      text: chalk.cyan(message),
      spinner: 'dots',
    }).start();
  }

  success(message: string) {
    this.spinner?.succeed(chalk.green(message));
  }

  error(message: string) {
    this.spinner?.fail(chalk.red(message));
  }

  stop() {
    this.spinner?.stop();
  }
}

export default new Loader();