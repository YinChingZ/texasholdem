"""Python 3 standard-library client. Replace decide() with your own Agent."""
import json
import os
import signal
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class AgentError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self):
        base = os.environ['HOLDEM_API_URL']
        u = urllib.parse.urlsplit(base)
        if u.username or u.password or u.query or u.fragment or not (
            u.scheme == 'https' or u.scheme == 'http' and u.hostname in ('localhost', '127.0.0.1', '::1')
        ):
            raise ValueError('HTTPS or localhost HTTP required')
        self.base = urllib.parse.urlunsplit((u.scheme, u.netloc, '/api/agent/v1/', '', ''))
        self.token = os.environ['HOLDEM_AGENT_TOKEN']
        self.stopped = threading.Event()

    def request(self, path, body=None, retries=2):
        for attempt in range(retries + 1):
            request = urllib.request.Request(self.base + path,
                data=None if body is None else json.dumps(body).encode(),
                headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
            try:
                with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
                    result = json.load(response)
                if not result.get('ok'):
                    raise AgentError(result.get('code', 'API_ERROR'))
                return result
            except urllib.error.HTTPError as error:
                try:
                    code = json.load(error).get('code', 'HTTP_ERROR')
                except (ValueError, AttributeError):
                    code = 'HTTP_ERROR'
                raise AgentError(code) from None
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt >= retries:
                    raise
                time.sleep(0.3 * 2 ** attempt)

    def heartbeat(self):
        while not self.stopped.wait(20):
            try:
                self.request('heartbeat', {})
            except AgentError:
                self.stopped.set()
            except (urllib.error.URLError, TimeoutError, OSError):
                pass

    def act(self, observation, decision):
        args = dict(requestId=str(uuid.uuid4()), handId=observation['handId'],
            turnId=observation['turnId'], controlVersion=observation['self']['controlVersion'], **decision)
        try:
            return self.request('actions', args, retries=0)
        except (urllib.error.URLError, TimeoutError, OSError):
            status = self.request('actions/' + args['requestId'])
            return status if status.get('receipt') else self.request('actions', args)


def decide(observation):
    # This example checks/folds; insert your model or strategy here.
    return {'action': 'check' if observation['legalActions']['check'] else 'fold'}


def main():
    client = Client()
    signal.signal(signal.SIGINT, lambda *_: client.stopped.set())
    result = client.request('connect', {})
    threading.Thread(target=client.heartbeat, daemon=True).start()
    completed = set()
    try:
        while not client.stopped.is_set():
            o = result.get('observation')
            if not o or o['self']['sittingOut'] or o['phase'] in ('ENDED', 'ERROR'):
                break
            last = o.get('lastResult')
            if last:
                completed.add(last['handId'])
            if len(completed) >= int(os.environ.get('HOLDEM_MAX_HANDS', '20')):
                break
            if o['legalActions']:
                choice = decide(o)
                if client.stopped.is_set():
                    break
                try:
                    result = client.act(o, choice)
                except AgentError as error:
                    if str(error) != 'STALE_TURN':
                        raise
                    result = client.request('observation')
            else:
                result = client.request('wait?revision=' + str(o['revision']))
    finally:
        client.stopped.set()
        try:
            client.request('release', {}, retries=0)
        except Exception:
            pass


if __name__ == '__main__':
    try:
        main()
    except AgentError as error:
        print(str(error))
