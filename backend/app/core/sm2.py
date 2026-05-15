"""
SuperMemo-2 (SM-2) spaced repetition algorithm.

Quality scale (0-5):
  0 - Complete blackout
  1 - Incorrect response; correct one remembered
  2 - Incorrect response; correct felt easy to recall
  3 - Correct response with serious difficulty
  4 - Correct response after a hesitation
  5 - Perfect response

UI labels:
  0-2 -> Again  (reset)
  3   -> Hard
  4   -> Good
  5   -> Easy
"""
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass


@dataclass
class SM2Result:
    repetitions: int
    easiness_factor: float
    interval: int
    next_review: datetime


def calculate_next_review(
    quality: int,
    repetitions: int,
    easiness_factor: float,
    interval: int,
) -> SM2Result:
    """
    Apply the SM-2 algorithm and return updated scheduling values.

    Args:
        quality: Rating 0-5
        repetitions: How many times this card has been answered correctly in a row
        easiness_factor: Current EF (starts at 2.5, min 1.3)
        interval: Current interval in days (0 = new card)

    Returns:
        SM2Result with updated fields and next_review datetime (UTC)
    """
    if quality < 0 or quality > 5:
        raise ValueError("Quality must be between 0 and 5")

    if quality < 3:
        # Failed: reset repetitions and interval
        new_repetitions = 0
        new_interval = 1
    else:
        # Passed
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * easiness_factor)
        new_repetitions = repetitions + 1

    # Update EF regardless of pass/fail (but only when quality >= 0)
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, round(new_ef, 4))

    next_review = datetime.now(timezone.utc) + timedelta(days=new_interval)

    return SM2Result(
        repetitions=new_repetitions,
        easiness_factor=new_ef,
        interval=new_interval,
        next_review=next_review,
    )
