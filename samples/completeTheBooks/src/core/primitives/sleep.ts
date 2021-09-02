export async function sleep(timeout: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}
