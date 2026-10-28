export function Toast({ msg, show }: { msg: string; show: boolean }) {
  return <div id="toast" className={'toast' + (show ? ' show' : '')} role="status">{msg}</div>;
}
