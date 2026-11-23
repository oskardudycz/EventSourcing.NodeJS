export const matchesBindingKey = (pattern: string, key: string): boolean => {
  const match = (patternWords: string[], keyWords: string[]): boolean => {
    if (patternWords.length === 0) return keyWords.length === 0;

    const [head, ...rest] = patternWords;

    if (head === '#')
      return (
        keyWords.some((_, skipped) => match(rest, keyWords.slice(skipped))) ||
        match(rest, [])
      );

    if (keyWords.length === 0) return false;

    return (
      (head === '*' || head === keyWords[0]) && match(rest, keyWords.slice(1))
    );
  };

  return match(pattern.split('.'), key === '' ? [] : key.split('.'));
};
