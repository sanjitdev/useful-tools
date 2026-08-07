#!/usr/bin/env python3
"""Verify the compound-interest fix against closed-form math.

The fix splits each month into 12 sub-steps and applies compounding only
when a period boundary is crossed. The number of periods elapsed at
sub-step s is floor(s * n * monthsTotal / (12 * subStepsTotal)).

This script re-implements the fixed buildSchedule in Python and compares
against the standard formulas:

  no contrib:     FV = P * (1 + r/n)^(n*t)
  end contrib:    FV = P*(1+r/n)^N + PMT * [(1+r/n)^N - 1] / (r/n)
  start contrib:  FV = P*(1+r/n)^N + PMT * (1+r/n) * [(1+r/n)^N - 1] / (r/n)
"""

from math import floor


def build_schedule(principal, monthly, annual_rate_pct, years, n, contrib_when):
    balance = principal
    contrib_to_date = 0.0
    interest_to_date = 0.0
    r = annual_rate_pct / 100.0
    rate_per_period = r / n
    months_total = years * 12
    periods_elapsed = 0
    sub_steps_per_month = 12
    sub_steps_total = months_total * sub_steps_per_month
    monthly_per_sub_step = monthly / sub_steps_per_month

    for s in range(1, sub_steps_total + 1):
        if contrib_when == 'start':
            balance += monthly_per_sub_step
            contrib_to_date += monthly_per_sub_step
        periods_now = (s * n * months_total) // (12 * sub_steps_total)
        while periods_elapsed < periods_now:
            interest = balance * rate_per_period
            balance += interest
            interest_to_date += interest
            periods_elapsed += 1
        if contrib_when == 'end':
            balance += monthly_per_sub_step
            contrib_to_date += monthly_per_sub_step
    return balance, interest_to_date


def closed_form_no_contrib(P, r, n, t):
    return P * (1 + r / n) ** (n * t)


def closed_form_contrib(P, PMT, r, n, t, when):
    rate_per_period = r / n
    N = n * t
    lump_fv = P * (1 + rate_per_period) ** N
    annuity_factor = ((1 + rate_per_period) ** N - 1) / rate_per_period
    if when == 'start':
        contrib_fv = PMT * (1 + rate_per_period) * annuity_factor
    else:
        contrib_fv = PMT * annuity_factor
    return lump_fv + contrib_fv


def main():
    print('=== No contributions: P=1000, r=5%, t=10 ===')
    for n in [1, 2, 4, 12, 365]:
        sim, _ = build_schedule(1000, 0, 5, 10, n, 'end')
        expected = closed_form_no_contrib(1000, 0.05, n, 10)
        diff = sim - expected
        ok = 'OK' if abs(diff) < 1e-6 else 'FAIL'
        print(f'  n={n:>3}  sim={sim:.4f}  expected={expected:.4f}  diff={diff:.6f}  {ok}')

    print('\n=== With $100/month, end-of-period: P=1000, r=5%, t=10 ===')
    for n in [1, 2, 4, 12, 365]:
        sim, _ = build_schedule(1000, 100, 5, 10, n, 'end')
        expected = closed_form_contrib(1000, 100, 0.05, n, 10, 'end')
        diff = sim - expected
        ok = 'OK' if abs(diff) < 0.01 else 'FAIL'
        print(f'  n={n:>3}  sim={sim:.4f}  expected={expected:.4f}  diff={diff:.4f}  {ok}')

    print('\n=== With $100/month, start-of-period: P=1000, r=5%, t=10 ===')
    for n in [1, 2, 4, 12, 365]:
        sim, _ = build_schedule(1000, 100, 5, 10, n, 'start')
        expected = closed_form_contrib(1000, 100, 0.05, n, 10, 'start')
        diff = sim - expected
        ok = 'OK' if abs(diff) < 0.01 else 'FAIL'
        print(f'  n={n:>3}  sim={sim:.4f}  expected={expected:.4f}  diff={diff:.4f}  {ok}')

    print('\n=== Monotonicity (annual < quarterly < monthly < daily) ===')
    for when in ['end', 'start']:
        a, _ = build_schedule(1000, 100, 5, 10, 1, when)
        q, _ = build_schedule(1000, 100, 5, 10, 4, when)
        m, _ = build_schedule(1000, 100, 5, 10, 12, when)
        d, _ = build_schedule(1000, 100, 5, 10, 365, when)
        ordered = a < q < m < d
        print(f'  when={when:>5}  a={a:.2f}  q={q:.2f}  m={m:.2f}  d={d:.2f}  monotonic? {ordered}')

    print('\n=== Edge: 30 years, monthly contrib, large balance ===')
    sim, _ = build_schedule(10000, 500, 7, 30, 12, 'end')
    expected = closed_form_contrib(10000, 500, 0.07, 12, 30, 'end')
    diff = sim - expected
    print(f'  sim={sim:.4f}  expected={expected:.4f}  diff={diff:.4f}')


if __name__ == '__main__':
    main()