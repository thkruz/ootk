export default () => {
  // eslint-disable-next-line no-process-env
  // A fixed UTC-5 zone: the bare "EST" alias resolved to UTC on the Linux CI runner.
  process.env.TZ = 'Etc/GMT+5';
};
