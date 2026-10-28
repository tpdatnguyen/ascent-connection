export function Toast({ msg, show }: { msg: string; show: boolean }) {
  return <div className={'toast' + (show ? ' show' : '')} role="status">{msg}</div>;
}
