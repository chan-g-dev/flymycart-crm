import { useCallback, useEffect, useState } from 'react';

// Each request owns its result. Changing filters cannot show a stale response.
export function useRemoteData(load, initialData = null) {
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState(null);
    useEffect(() => {
        let active = true;
        Promise.resolve().then(load).then(
            data => { if (active) setResult({ load, revision, data, error: null }); },
            error => { if (active) setResult({ load, revision, data: initialData, error }); },
        );
        return () => { active = false; };
    }, [load, revision, initialData]);
    const current = result?.load === load && result?.revision === revision;
    const reload = useCallback(() => setRevision(value => value + 1), []);
    return {
        data: current ? result.data : initialData,
        error: current ? result.error : null,
        loading: !current,
        reload,
    };
}
