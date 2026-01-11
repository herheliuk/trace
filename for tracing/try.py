from hashlib import md5

def source_data():
    return [2, 4, 6, 8]

def expand_data(data):
    def inner_expand():
        return [x + 1 for x in data]
    return inner_expand()

def transform_data(data):
    def multiplier(x):
        return x * 3
    return [multiplier(x) for x in data]

def summarize_data(data):
    total = sum(data)
    count = len(data)
    def stats():
        return {"total": total, "count": count, "average": total / count}
    return stats()

def coordinator():
    raw = source_data()
    expanded = expand_data(raw)
    transformed = transform_data(expanded)
    summary = summarize_data(transformed)
    return {"raw": raw, "expanded": expanded, "transformed": transformed, "summary": summary}

def deep_vote(payload):
    score = 0
    def vote_raw():
        nonlocal score
        score += sum(payload["raw"])
        def vote_expanded():
            nonlocal score
            score += sum(payload["expanded"])
            def vote_transformed():
                nonlocal score
                score += sum(payload["transformed"])
                def vote_summary():
                    nonlocal score
                    score += int(payload["summary"]["average"]) # !
                    return score
                return vote_summary()
            return vote_transformed()
        return vote_expanded()
    return vote_raw()

def consensus():
    data = coordinator()
    decision = deep_vote(data)
    return {"data": data, "decision": decision}

def final_output():
    result = consensus()
    def formatter():
        return f"{result['decision']} using {result}"
    return formatter()

def main():
    return final_output()

output = main()
hash = md5(output.encode()).hexdigest()
print(output, '\n\n', hash == "46dc8295fc40b6c176c8973ce4fcc6dc", hash)
