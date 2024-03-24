describe('Timezones', () => {
  it('should always be EST', () => {
    // This is so that we can check local and utc calculations
    expect(new Date().getTimezoneOffset()).toBe(300);
  });
});
