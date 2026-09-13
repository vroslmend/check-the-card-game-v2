// One PASS or FAIL line per assertion, and an exit code that says whether any
// failed. `npm test` reads only the exit code.

export const createReport = ({ buffered = false } = {}) => {
  const lines = [];
  let checks = 0;
  let failures = 0;
  // Scenarios that run at the same time buffer their lines, or their output
  // interleaves.
  const write = (line) => (buffered ? lines.push(line) : console.log(line));

  return {
    lines,
    get checks() {
      return checks;
    },
    get failures() {
      return failures;
    },
    check(name, passed, detail = "") {
      checks++;
      if (!passed) failures++;
      write(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`);
    },
    absorb(other) {
      for (const line of other.lines) console.log(line);
      checks += other.checks;
      failures += other.failures;
    },
    // Exits either way, so a timer an actor left behind cannot hold the process
    // open after the last assertion.
    finish({ passed, failed }) {
      if (failures > 0) {
        console.error(failed(failures));
        process.exit(1);
      }
      console.log(passed(checks));
      process.exit(0);
    },
  };
};
