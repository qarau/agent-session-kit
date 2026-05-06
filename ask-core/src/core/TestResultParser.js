function normalize(value) {
  return String(value ?? '').trim();
}

export class TestResultParser {
  summarize(command, result) {
    return {
      command: normalize(command),
      status: result?.exitCode === 0 ? 'passed' : 'failed',
      exitCode: Number(result?.exitCode ?? 1),
      failureReason: normalize(result?.failureReason),
    };
  }
}
