(function() {
    const pointsPerLevel = 100;

    window.OrangeForumProgression = Object.freeze({
        getPoints: function(member) {
            return member.posts * 10 + member.likes + member.commentsPosted * 2;
        },
        getLevel: function(points) {
            if (!Number.isSafeInteger(points) || points < 0) {
                throw new RangeError("Điểm diễn đàn phải là số nguyên không âm.");
            }

            const progress = points % pointsPerLevel;
            return {
                number: Math.floor(points / pointsPerLevel) + 1,
                pointsPerLevel: pointsPerLevel,
                progress: progress,
                pointsToNext: pointsPerLevel - progress
            };
        }
    });
})();
