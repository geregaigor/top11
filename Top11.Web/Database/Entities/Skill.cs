using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Top11.Web.Database.Entities
{
	public class Skill
	{
		public SkillType SkillType { get; set; }
		public int Value { get; set; }
		public bool IsMain { get; set; }
		public bool IsTierUp { get; set; }

		public int PlayerId { get; set; }
		public Player Player { get; set; } = null!;
	}

	public enum SkillType
	{
		TACKLING,
		MARKING,
		POSITIONING,
		HEADING,
		BRAVERY,

		PASSING,
		DRIBBLING,
		CROSSING,
		SHOOTING,
		FINISHING,

		FITNESS,
		STRENGTH,
		AGGRESSION,
		SPEED,
		CREATIVITY,

		REFLEXES,
		AGILITY,
		ANTICIPATION,
		RUSHING_OUT,
		COMMUNICATION,

		THROWING,
		KICKING,
		PUNCHING,
		AERIAL_REACH,
		CONCENTRATION,
	}

	internal class SkillConfiguration : IEntityTypeConfiguration<Skill>
	{
		public void Configure(EntityTypeBuilder<Skill> builder)
		{
			builder.HasKey(e => new { e.PlayerId, e.SkillType });

			builder.Property(p => p.SkillType)
				.HasConversion<string>()
				.HasMaxLength(50);
		}
	}
}
